"""Fault injection and concurrent API commands, with real PostgreSQL assertions."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import time
import requests
from verify_e2e import Acceptance, ROOT


def run(args, suite):
    suite.login()
    params = dict(productId=1, requestedAmountRub=3000000, termMonths=36, projectedRevenueUpliftMonthlyRub=150000, upliftStartMonth=4)
    if args.phase == 'outage':
        before = suite.rows('SELECT count(*) FROM loan_applications')[0][0]
        error = suite.api('POST', '/api/v1/simulations', 'owner', params, 503)
        assert error['code'] == 'ENGINE_UNAVAILABLE'
        assert suite.rows('SELECT count(*) FROM loan_applications')[0][0] == before
        app = suite.create(params)
        error = suite.api('POST', f"/api/v1/applications/{app['id']}/submit", 'owner', status=503)
        assert error['code'] == 'ENGINE_UNAVAILABLE'
        app = suite.api('GET', f"/api/v1/applications/{app['id']}", 'owner')
        assert app['status'] == 'CHECKING' and app['scoring'] is None
        assert [h['toStatus'] for h in app['history']] == ['DRAFT', 'CHECKING']
        assert suite.rows('SELECT count(*) FROM scoring_results WHERE application_id=%s', app['id'])[0][0] == 0
        snapshots = suite.snapshots(app['id'])
        assert len(snapshots) == 1
        args.state.parent.mkdir(parents=True, exist_ok=True)
        args.state.write_text(json.dumps({'id': app['id'], 'snapshots': snapshots}, ensure_ascii=False), encoding='utf-8')
        suite.check('Engine outage: real 503, committed CHECKING and snapshot, no fabricated scoring or simulation side effects')
    elif args.phase == 'recovery':
        state = json.loads(args.state.read_text(encoding='utf-8'))
        deadline = time.monotonic() + 45
        while True:
            response = suite.session.post(
                suite.base + '/api/v1/simulations',
                json=params,
                headers={'Authorization': 'Bearer ' + suite.tokens['owner']},
                timeout=35,
            )
            if response.status_code == 200:
                break
            assert response.status_code == 503, response.text[:800]
            if time.monotonic() >= deadline:
                raise AssertionError('Financial engine did not become reachable through backend within 45 seconds')
            time.sleep(1)
        app = suite.api('POST', f"/api/v1/applications/{state['id']}/submit", 'owner')
        assert app['status'] == 'UNDER_REVIEW' and app['scoring'] is not None
        assert [list(row) for row in suite.snapshots(app['id'])] == state['snapshots']
        assert suite.rows('SELECT count(*) FROM scoring_results WHERE application_id=%s', app['id'])[0][0] == 1
        assert [h['toStatus'] for h in app['history']] == ['DRAFT', 'CHECKING', 'UNDER_REVIEW']
        suite.database_application(app['id'], app)
        suite.check('Engine recovery: retry uses original snapshot, exactly one score and review transition')
    else:
        app = suite.create(params)

        def invoke(path, actor, body=None):
            session = requests.Session()
            session.trust_env = False
            return session.post(args.base_url.rstrip('/') + path, json=body, headers={'Authorization': 'Bearer ' + suite.tokens[actor]}, timeout=35)

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: invoke(f"/api/v1/applications/{app['id']}/submit", 'owner'), range(2)))
        assert all(r.status_code in (200, 409) for r in results), [r.text for r in results]
        assert any(r.status_code == 200 for r in results)
        assert suite.rows('SELECT count(*) FROM scoring_results WHERE application_id=%s', app['id'])[0][0] == 1
        assert len(suite.snapshots(app['id'])) == 1
        assert suite.rows('SELECT count(*) FROM application_status_history WHERE application_id=%s', app['id'])[0][0] == 3
        decisions = [dict(decision='APPROVE', comment='Concurrent synthetic approval', offeredAmountRub=2800000, offeredTermMonths=36), dict(decision='DECLINE', comment='Concurrent synthetic rejection')]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda body: invoke(f"/api/v1/bank/applications/{app['id']}/decision", 'bank', body), decisions))
        assert sorted(r.status_code for r in results) == [200, 409], [r.text for r in results]
        assert suite.rows('SELECT count(*) FROM credit_decisions WHERE application_id=%s', app['id'])[0][0] == 1
        app = suite.api('GET', f"/api/v1/applications/{app['id']}", 'owner')
        assert app['status'] in ('OFFERED', 'DECLINED') and len(app['history']) == 4
        suite.database_application(app['id'], app)
        suite.check('Concurrent submit and conflicting officer decisions persist exactly one result')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://localhost:8080')
    parser.add_argument('--database-url', default=os.environ.get('TEST_DATABASE_URL', 'postgresql://alfa@127.0.0.1:55432/alfa'))
    parser.add_argument('--phase', choices=['outage', 'recovery', 'concurrency'], required=True)
    parser.add_argument('--state', type=Path, default=ROOT / 'verification-results/outage-state.json')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report = args.report or ROOT / f'verification-results/{args.phase}-report.json'
    report.parent.mkdir(parents=True, exist_ok=True)
    evidence = {'passed': False, 'phase': args.phase, 'checks': []}
    report.write_text(json.dumps(evidence), encoding='utf-8')
    suite = None
    try:
        suite = Acceptance(args)
        evidence['checks'] = suite.checks
        run(args, suite)
        evidence['passed'] = True
    except Exception as exc:
        evidence['error'] = str(exc)
        raise
    finally:
        report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')
        if suite is not None:
            suite.db.close()


if __name__ == '__main__':
    main()
