# Financial Engine

Stateless Python 3.12 / FastAPI service for synthetic scenario planning. It neither stores applications nor changes statuses. Recommendations are a transparent demonstration heuristic; the bank officer makes the final decision. No external financial services, models, credentials, or real customer data are used.

## Run and verify

From this directory:

```sh
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest -q
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Docker (standalone local verification only):

```sh
docker build -t alfa-financial-engine .
docker run --rm -p 127.0.0.1:8000:8000 alfa-financial-engine
```

In the complete stack, use `docker compose up --build` at repository root. The engine port stays on the internal Docker network; only the backend calls it at `http://financial-engine:8000`. The image runs as an unprivileged user and contains an HTTP healthcheck. API documentation is at `/docs` on the internal service.

```sh
curl http://localhost:8000/internal/v1/health
curl -H 'Content-Type: application/json' --data-binary @tests/fixtures/evaluate-request.json http://localhost:8000/internal/v1/evaluate
```

## Contract and rounding

The frozen contract is `../contracts/financial-engine-api.yaml`. Both routes, JSON property names, required fields, and enums are covered by tests; nested unknown properties and invalid financial input return HTTP 422. Unexpected errors return a generic structured HTTP 500, never fabricated results or internal exception text.

Annuity uses Decimal precision of at least 50 digits, with HALF_UP integer rubles. DSCR uses the exact average revenue and expenses of the latest three chronological months, the rounded annuity payment, and existing debt. Score/recommendation thresholds use unrounded DSCR; only the returned DSCR is rounded HALF_UP to two decimal places. User uplift never increases DSCR or score.

For each forecast month, compute revenue from the exact average and stress plus any uplift, then round revenue and expenses HALF_UP to integer rubles. Derive net cash and the closing balance from those integer components, so every displayed cash-flow row reconciles exactly. Cash starts from the existing balance: the investment loan is fully spent in month zero. Minimum cash is the minimum of the 12 forecast closing balances, excluding opening cash. These rounding choices resolve the task's permitted forecast rounding convention without changing frozen formulas.

Alternatives assess 100%, 80%, and 60% amounts, HALF_UP rounded and filtered by product limits, without calling evaluate recursively. They sort by LOW/MEDIUM/HIGH, then amount descending. They are simulations, not bank offers.

## Test fixtures

`tests/fixtures/evaluate-request.json` and `evaluate-response.json` are a stable, synthetic golden example: 3,000,000 RUB / 36 months / 20%, historical revenue 2,100,000 and expenses 1,450,000. Independent assertions check payment 111,491 RUB, DSCR 2.81, score 1000, LOW/APPROVE, and BASE closing cash 8,172,108 RUB in month 12. The request's applicationId may be null or a positive ID without changing its result. `seed-request.json` and `seed-response.json` match the backend's deterministic varying monthly seed and support integration comparisons.

Tests cover formula and recommendation thresholds, all penalty caps, rounding, ordering, zero inputs, invalid inputs, financial identities, three stress scenarios, negative cash, alternatives, schema compliance, HTTP error handling, and golden fixtures. TestClient exercises the actual ASGI app. Full database persistence and bank-workflow verification belong to backend/E2E testing.

All dependency versions, including transitives resolved for Python 3.12, are pinned in `requirements.txt`. This remains a demo service on a trusted internal network, with no authentication layer of its own as specified by the architecture.
