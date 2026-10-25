"""Real HTTP + PostgreSQL acceptance checks; only synthetic test data.

Install scripts/requirements.txt. See scripts/README.md for usage.
Does not reset the database; creates new applications and restores company inputs.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import sys
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import jsonschema
import psycopg
import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def normalize_schema(value):
    if isinstance(value, list):
        return [normalize_schema(item) for item in value]
    if not isinstance(value, dict):
        return value
    result = {key: normalize_schema(item) for key, item in value.items() if key != 'nullable'}
    return {'anyOf': [result, {'type': 'null'}]} if value.get('nullable') else result


class Acceptance:
    def __init__(self, args):
        self.args = args
        self.base = args.base_url.rstrip('/')
        self.spec = normalize_schema(yaml.safe_load((ROOT / 'contracts/public-api.yaml').read_text(encoding='utf-8')))
        self.session = requests.Session()
        self.session.trust_env = False
        self.tokens = {}
        self.coverage = set()
        self.checks = []
        self.db = psycopg.connect(args.database_url, autocommit=True)

    def schema(self, value, schema):
        root = {'components': self.spec['components'], **schema}
        jsonschema.Draft7Validator(root, format_checker=jsonschema.FormatChecker()).validate(value)

    def api(self, method, path, actor=None, body=None, status=200):
        headers = {'Authorization': 'Bearer ' + self.tokens[actor]} if actor else {}
        response = self.session.request(method, self.base + path, json=body, headers=headers, timeout=35)
        assert response.status_code == status, f'{method} {path}: expected {status}, got {response.status_code}: {response.text[:800]}'
        assert 'application/json' in response.headers.get('Content-Type', ''), f'Non-JSON response: {path}'
        data = response.json()
        route = re.sub(r'/\d+(?=/|$)', '/{id}', path.split('?')[0])
        operation = self.spec['paths'][route][method.lower()]
        if status < 400:
            self.schema(data, operation['responses'][str(status)]['content']['application/json']['schema'])
            self.coverage.add((method.lower(), route))
        else:
            self.schema(data, {'$ref': '#/components/schemas/ApiError'})
        return data

    def check(self, name):
        self.checks.append(name)
        print('PASS:', name, flush=True)

    def login(self):
        for actor, email in [('owner', 'owner@demo.local'), ('bank', 'bank@demo.local'), ('other', 'owner2@demo.local')]:
            result = self.api('POST', '/api/v1/auth/login', body={'email': email, 'password': 'Demo123!'})
            self.tokens[actor] = result['accessToken']

    def rows(self, query, *params):
        return self.db.execute(query, params).fetchall()

    def snapshots(self, application_id):
        return self.rows('SELECT id, company_and_financials_snapshot_json, product_snapshot_json, engine_request_json, captured_at::text FROM application_snapshots WHERE application_id=%s ORDER BY id', application_id)

    def database_application(self, application_id, view):
        assert self.rows('SELECT status FROM loan_applications WHERE id=%s', application_id)[0][0] == view['status']
        statuses = self.rows('SELECT from_status, to_status, actor_role, comment FROM application_status_history WHERE application_id=%s ORDER BY id', application_id)
        assert statuses == [(h['fromStatus'], h['toStatus'], h['actorRole'], h['comment']) for h in view['history']]
        times = [datetime.fromisoformat(h['changedAt'].replace('Z', '+00:00')) for h in view['history']]
        assert times == sorted(times)
        for previous, current in zip(view['history'], view['history'][1:]):
            assert previous['toStatus'] == current['fromStatus']
        assert all(h['actorRole'] in ('ENTREPRENEUR', 'BANK_OFFICER') for h in view['history'])
        if view['scoring']:
            score = self.rows('SELECT score, dscr, monthly_payment_rub, factors_json FROM scoring_results WHERE application_id=%s ORDER BY id DESC LIMIT 1', application_id)[0]
            assert (score[0], float(score[1]), score[2], json.loads(score[3])) == (view['scoring']['score'], view['scoring']['dscr'], view['scoring']['monthlyPaymentRub'], view['scoring']['factors'])

    def create(self, params):
        return self.api('POST', '/api/v1/applications', 'owner', {**params, 'purpose': 'EQUIPMENT'}, 201)

    def submit(self, application):
        result = self.api('POST', f"/api/v1/applications/{application['id']}/submit", 'owner')
        assert result['status'] == 'UNDER_REVIEW'
        assert [h['toStatus'] for h in result['history']][-2:] == ['CHECKING', 'UNDER_REVIEW']
        assert result['scoring'] and result['financialSnapshot'] and result['submittedAt']
        self.database_application(result['id'], result)
        return result

    def decision(self, application, decision, **offer):
        return self.api('POST', f"/api/v1/bank/applications/{application['id']}/decision", 'bank', {'decision': decision, 'comment': 'Синтетическая проверка: ' + decision, **offer})

    def run(self):
        self.login()
        self.api('GET', '/api/v1/auth/me', status=401)
        self.api('POST', '/api/v1/auth/login', body={'email': 'owner@demo.local', 'password': 'incorrect'}, status=401)
        me = self.api('GET', '/api/v1/auth/me', 'owner')
        assert me['role'] == 'ENTREPRENEUR' and me['companyId'] == 1
        self.api('GET', '/api/v1/bank/applications', 'owner', status=403)
        self.api('GET', '/api/v1/companies/me', 'bank', status=403)
        self.check('Authentication and role guards; structured errors')

        products = self.api('GET', '/api/v1/credit-products', 'owner')
        product = next(p for p in products if p['id'] == 1)
        assert product['annualRatePct'] == 20 and product['allowedTermsMonths'] == [12, 24, 36, 48, 60]
        company = self.api('GET', '/api/v1/companies/me', 'owner')
        params = dict(productId=1, requestedAmountRub=3000000, termMonths=36, projectedRevenueUpliftMonthlyRub=150000, upliftStartMonth=4)
        initial_count = self.rows('SELECT count(*) FROM loan_applications')[0][0]
        sim = self.api('POST', '/api/v1/simulations', 'owner', params)
        assert self.rows('SELECT count(*) FROM loan_applications')[0][0] == initial_count
        rate = Decimal(str(product['annualRatePct'])) / 1200
        payment = int((Decimal(params['requestedAmountRub']) * rate / (1 - (1 + rate) ** -params['termMonths'])).quantize(Decimal(1), rounding=ROUND_HALF_UP))
        assert sim['monthlyPaymentRub'] == payment
        last = sorted(company['financials'], key=lambda f: f['month'])[-3:]
        margin = max(Decimal(0), sum(Decimal(f['revenueRub'] - f['operatingExpensesRub']) for f in last) / 3)
        expected_dscr = (margin / max(1, company['existingDebtMonthlyRub'] + payment)).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
        assert Decimal(str(sim['dscr'])) == expected_dscr
        assert [s['name'] for s in sim['scenarios']] == ['BASE', 'STRESS_15', 'STRESS_30']
        for scenario in sim['scenarios']:
            cash = company['cashBalanceRub']
            assert len(scenario['months']) == 12
            for index, month in enumerate(scenario['months'], 1):
                assert month['monthIndex'] == index
                assert month['debtPaymentRub'] == company['existingDebtMonthlyRub'] + payment
                assert month['netCashFlowRub'] == month['revenueRub'] - month['operatingExpensesRub'] - month['debtPaymentRub']
                cash += month['netCashFlowRub']
                assert month['cashEndRub'] == cash
            assert scenario['negativeCashMonths'] == sum(m['cashEndRub'] < 0 for m in scenario['months'])
            assert scenario['minCashBalanceRub'] == min(m['cashEndRub'] for m in scenario['months'])
        for base, stressed in zip(sim['scenarios'][0]['months'], sim['scenarios'][2]['months']):
            assert stressed['cashEndRub'] <= base['cashEndRub']
        bigger = self.api('POST', '/api/v1/simulations', 'owner', {**params, 'requestedAmountRub': 5000000})
        assert bigger['monthlyPaymentRub'] > payment and bigger['dscr'] <= sim['dscr']
        self.check('Real simulation, independent PMT/DSCR oracle, cash-flow conservation, stress ordering, no application side effects')

        for invalid in [{'upliftStartMonth': 13}, {'requestedAmountRub': 99999}, {'termMonths': 7}, {'annualRatePct': 0}, {'requestedAmountRub': 3000000.5}]:
            self.api('POST', '/api/v1/simulations', 'owner', {**params, **invalid}, 400)
        original_financials = {k: copy.deepcopy(company[k]) for k in ('cashBalanceRub', 'existingDebtMonthlyRub', 'financials')}
        bad = copy.deepcopy(original_financials)
        bad['financials'][1]['month'] = bad['financials'][0]['month']
        self.api('PUT', '/api/v1/companies/me/financials', 'owner', bad, 400)
        self.api('PUT', '/api/v1/companies/me/financials', 'owner', {**original_financials, 'taxDebtRub': 0}, 400)
        self.check('Server validation, duplicate months, fractional rubles, limits, forbidden fields')

        app = self.create(params)
        assert app['status'] == 'DRAFT' and app['scoring'] is None and app['offer'] is None
        app = self.api('PUT', f"/api/v1/applications/{app['id']}", 'owner', {**params, 'purpose': 'EXPANSION'})
        app = self.submit(app)
        for key in ('score', 'dscr', 'monthlyPaymentRub', 'riskLevel', 'recommendation', 'factors'):
            assert app['scoring'][key] == sim[key], key
        snapshot_before = self.snapshots(app['id'])
        self.api('POST', f"/api/v1/applications/{app['id']}/accept-offer", 'owner', status=409)
        self.api('POST', f"/api/v1/applications/{app['id']}/submit", 'owner', status=409)
        self.api('POST', f"/api/v1/bank/applications/{app['id']}/decision", 'owner', {'decision': 'DECLINE', 'comment': 'forbidden'}, 403)
        self.api('POST', f"/api/v1/bank/applications/{app['id']}/decision", 'bank', {'decision': 'APPROVE', 'comment': 'invalid', 'offeredAmountRub': 4000000, 'offeredTermMonths': 36}, 400)
        app = self.decision(app, 'APPROVE', offeredAmountRub=2800000, offeredTermMonths=36)
        assert app['status'] == 'OFFERED' and app['offer']['amountRub'] == 2800000 and app['offer']['annualRatePct'] == 20
        decision = self.rows('SELECT decision, offered_amount_rub, offered_term_months, offered_annual_rate_pct, decided_by_user_id FROM credit_decisions WHERE application_id=%s', app['id'])
        banker = self.api('GET', '/api/v1/auth/me', 'bank')
        assert len(decision) == 1 and decision[0] == ('APPROVE', 2800000, 36, Decimal('20.00'), banker['id'])
        app = self.api('POST', f"/api/v1/applications/{app['id']}/accept-offer", 'owner')
        assert app['status'] == 'ACCEPTED'
        app = self.api('POST', f"/api/v1/bank/applications/{app['id']}/simulate-disbursement", 'bank')
        assert app['status'] == 'SIMULATED_ISSUED'
        self.database_application(app['id'], app)
        assert len(self.snapshots(app['id'])) == 1
        self.check('A: approval → offer → acceptance → simulated disbursement; DB history and scores match API')

        rejected = self.decision(self.submit(self.create(params)), 'DECLINE')
        assert rejected['status'] == 'DECLINED' and rejected['offer'] is None
        self.api('POST', f"/api/v1/applications/{rejected['id']}/accept-offer", 'owner', status=409)
        self.database_application(rejected['id'], rejected)
        self.check('B: rejection with officer explanation and no acceptance path')

        info = self.decision(self.submit(self.create(params)), 'REQUEST_INFO')
        assert info['status'] == 'NEEDS_INFO'
        old_snapshots = self.snapshots(info['id'])
        try:
            updated = copy.deepcopy(original_financials)
            for row in updated['financials']:
                row['revenueRub'] += 350000
            new_company = self.api('PUT', '/api/v1/companies/me/financials', 'owner', updated)
            assert new_company['financialsVersion'] == company['financialsVersion'] + 1
            new_sim = self.api('POST', '/api/v1/simulations', 'owner', params)
            assert new_sim['dscr'] > sim['dscr']
            assert self.snapshots(app['id']) == snapshot_before
            old_view = self.api('GET', f"/api/v1/applications/{app['id']}", 'owner')
            assert old_view['financialSnapshot'] == app['financialSnapshot']
            assert old_view['scoring'] == app['scoring']
            edited = self.api('PUT', f"/api/v1/applications/{info['id']}", 'owner', {**params, 'purpose': 'WORKING_CAPITAL'})
            assert edited['status'] == 'NEEDS_INFO'
            info = self.api('POST', f"/api/v1/applications/{info['id']}/resubmit", 'owner')
            assert info['status'] == 'UNDER_REVIEW' and info['scoring']['dscr'] == new_sim['dscr']
            snapshots = self.snapshots(info['id'])
            assert len(snapshots) == 2 and snapshots[:1] == old_snapshots
            assert self.rows('SELECT count(*) FROM scoring_results WHERE application_id=%s', info['id'])[0][0] == 2
            self.database_application(info['id'], info)
        finally:
            self.api('PUT', '/api/v1/companies/me/financials', 'owner', original_financials)
        self.check('C/E: information request, financial update, resubmission; new simulation and immutable old snapshots')

        for path, method in [(f"/api/v1/applications/{app['id']}", 'GET'), (f"/api/v1/applications/{app['id']}/submit", 'POST')]:
            self.api(method, path, 'other', status=403)
        self.api('PUT', f"/api/v1/applications/{app['id']}", 'other', {**params, 'purpose': 'EQUIPMENT'}, 403)
        for action in ('resubmit', 'accept-offer'):
            self.api('POST', f"/api/v1/applications/{app['id']}/{action}", 'other', status=403)
        others = self.api('GET', '/api/v1/applications', 'other')
        assert all(item['companyId'] != 1 for item in others)
        own = self.api('GET', '/api/v1/applications', 'owner')
        assert all(item['companyId'] == 1 for item in own)
        queue = self.api('GET', '/api/v1/bank/applications?status=UNDER_REVIEW', 'bank')
        assert any(item['id'] == info['id'] for item in queue) and all(item['status'] == 'UNDER_REVIEW' for item in queue)
        self.check('D: cross-company access denied and lists isolated; bank filter')

        expected_routes = {(method, path) for path, methods in self.spec['paths'].items() for method in methods if method in ('get', 'post', 'put')}
        assert self.coverage == expected_routes, f'Uncovered public operations: {expected_routes - self.coverage}'
        self.check(f'All {len(self.coverage)} frozen public HTTP operations exercised and responses schema-validated')
        state = {'applications': [self.api('GET', f"/api/v1/applications/{item['id']}", 'owner') for item in (app, rejected, info)]}
        state['snapshots'] = {str(item['id']): self.snapshots(item['id']) for item in (app, rejected, info)}
        self.args.state.parent.mkdir(parents=True, exist_ok=True)
        self.args.state.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
        return state

    def verify_persistence(self):
        self.login()
        state = json.loads(self.args.state.read_text(encoding='utf-8'))
        for expected in state['applications']:
            current = self.api('GET', f"/api/v1/applications/{expected['id']}", 'owner')
            assert current == expected, f"Persisted application changed: {expected['id']}"
            assert [list(row) for row in self.snapshots(expected['id'])] == state['snapshots'][str(expected['id'])]
            self.database_application(expected['id'], current)
        self.check('F: stored applications, scores, histories and snapshots unchanged after externally performed restart')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://localhost:8080')
    parser.add_argument('--database-url', default=os.environ.get('TEST_DATABASE_URL', 'postgresql://alfa@127.0.0.1:55432/alfa'))
    parser.add_argument('--state', type=Path, default=ROOT / 'verification-results/e2e-state.json')
    parser.add_argument('--report', type=Path, default=ROOT / 'verification-results/e2e-report.json')
    parser.add_argument('--verify-persistence', action='store_true')
    args = parser.parse_args()
    suite = None
    report = {'startedAt': datetime.now(timezone.utc).isoformat(), 'baseUrl': args.base_url, 'checks': [], 'passed': False}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report), encoding='utf-8')
    try:
        suite = Acceptance(args)
        report['checks'] = suite.checks
        suite.verify_persistence() if args.verify_persistence else suite.run()
        report['passed'] = True
    except Exception as exc:
        report['passed'] = False
        report['error'] = str(exc)
        raise
    finally:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        if suite is not None:
            suite.db.close()


if __name__ == '__main__':
    main()
