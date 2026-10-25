# ALFA BUSINESS NAVIGATOR

A working demonstration of a small-business credit workflow: scenario Business Twin, explainable deterministic scoring, financing alternatives, and a separate bank-officer decision. **Demo / synthetic data / not a bank offer.** No real personal or customer financial data, external banking integrations, signatures, or money transfers are used.

## Start

Prerequisites: Docker Engine/Desktop with Docker Compose v2. Run from the repository root:

```sh
docker compose up --build
```

The first build downloads pinned application dependencies and initializes PostgreSQL using Flyway. Wait for services to become healthy. Open [the application](http://localhost:5173) and [Swagger UI](http://localhost:8080/swagger-ui.html). Health: [backend](http://localhost:8080/actuator/health). Only ports 5173 and 8080 bind to localhost; PostgreSQL and the financial engine remain internal.

```sh
docker compose ps
docker compose logs --tail=100 backend financial-engine
```

Optional environment overrides are in `.env.example`; copy to `.env` for local settings. The checked-in defaults and passwords are public synthetic demo credentials, **NOT for production**. Keep real secrets out of Git.

| Account | Password | Access |
|---|---|---|
| owner@demo.local | Demo123! | Entrepreneur, company1 / ООО «ТехноСтрой» |
| bank@demo.local | Demo123! | Bank officer, all applications |
| owner2@demo.local | Demo123! | Additional QA entrepreneur, separate company2 |

## Five-minute demonstration

1. Sign in as owner. Inspect 12 months of company finances and the credit products. Open Business Twin and select product1, 3,000,000 RUB, 36 months, 150,000 RUB expected monthly uplift from month4. Compare BASE, STRESS_15 and STRESS_30 cash forecasts. Change the amount to 5,000,000 and back to see real recalculation.
2. Create an EQUIPMENT draft and submit. The server commits CHECKING, snapshots the financial inputs, calls Python, persists scoring and enters UNDER_REVIEW. A scoring recommendation is separate from the final bank decision.
3. Sign in as bank. Approve 2,800,000 RUB over 36 months with a comment; the 20% annual rate comes from the product. Sign in as owner and accept. Return as bank and simulate disbursement: SIMULATED_ISSUED, with an auditable timeline and no real transfer.
4. Create another application, submit and decline as bank. Create a third, submit and request information as bank. Update company financials as owner, resubmit and inspect the new snapshot and score; the previous snapshot remains unchanged in PostgreSQL.
5. Sign in as owner2 and verify applications belonging to owner1 cannot be opened. Restart services and check the persisted data again:

```sh
docker compose restart
```

`docker compose down` preserves the named database volume. **Do not use `down -v` for persistence verification**; it deletes the demo database volume.

## Architecture and contracts

React18/TypeScript/Vite/Ant Design/TanStack Query/React Router/Recharts → Java21/Spring Boot3/JWT/JPA/Flyway → PostgreSQL16. Backend alone calls the stateless Python3.12/FastAPI/Pydantic2 financial engine. The frontend uses real `/api/v1` HTTP endpoints; no production mock switch is enabled.

Read [architecture](docs/architecture.md), [data model](docs/data-model.md), [status machine](docs/status-state-machine.md), [test scenarios](docs/test-scenarios.md), and [product decisions](docs/product-decisions.md). Frozen source of truth: `00_SHARED_CONTRACT.md`, `contracts/public-api.yaml`, `contracts/financial-engine-api.yaml`. Every public route is defined there; no delete or administrative bypass API is added.

Money uses integer RUB, annual interest uses percentages, times are ISO8601 UTC. Bank decisions are server-authorized; company ownership is checked on every application action. Strict input DTOs reject unknown financial/role/status fields and fractional money. Immutable snapshots retain submitted financial versions. Engine failures return `503 ENGINE_UNAVAILABLE` and preserve CHECKING, so the owner can retry submit without fabricated scores or duplicate persisted completion.

## Tests and local development

Backend (Java21 required; Maven3.9.9 Wrapper included):

```sh
cd backend
./mvnw test
./mvnw package
```

On Windows use `mvnw.cmd`. Unit tests always run. PostgreSQL integration tests run automatically through Testcontainers when Docker is available; when Docker is unavailable that suite explicitly skips. To run the same API scenarios against an existing isolated PostgreSQL16 database, set `RUN_DB_TESTS=true`, `DATABASE_URL=jdbc:postgresql://localhost:5432/navigator`, `DATABASE_USER`, and `DATABASE_PASSWORD`, then run `./mvnw test`. The suite uses a mocked engine; real cross-service behavior is covered by the repository E2E script. Use a test database: these tests intentionally create synthetic records and briefly change/restore financial data.

Engine:

```sh
cd financial-engine
python -m venv .venv
# Activate .venv using the shell-specific command.
pip install -r requirements.txt
pytest -q
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```sh
cd frontend
npm ci
npm run build
npm test -- --run
npm run dev
```

Outside Docker, configure `BACKEND_URL=http://localhost:8080` for the Vite proxy. Start backend with `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `FINANCIAL_ENGINE_URL=http://localhost:8000` and `JAVA_HOME` pointing to Java21:

```sh
java -jar backend/target/business-navigator-1.0.0.jar
```

Additional backend environment variables: `JWT_SECRET` (at least32 UTF-8 bytes), `CORS_ALLOWED_ORIGINS` (comma-separated exact origins), `SERVER_PORT` (default8080). Compose sets internal service URLs itself.

## Honest limitations

This is a synthetic heuristic, not a trained default model or licensed banking decision engine. Forecasts use the last three historical months and user-proposed uplift, with no promise of future revenue. Local tax/business-activity/credit-history fields are synthetic. The bank officer performs all final decisions. Authentication has no MFA, password reset, refresh/revocation system or production rate limits. Vite is intentionally the reproducible demo server.

Verification results and environment-specific limitations are recorded in `docs/DEVELOPMENT_STATUS.md`. A green local build does not by itself prove Docker startup or browser E2E; the report distinguishes them. See `THIRD_PARTY_NOTICES.md` for dependencies and synthetic fixtures.
