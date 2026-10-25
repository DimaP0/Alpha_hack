# Development status

Verified again on 2026-10-24 on macOS/ARM64 with Docker 29.0.1, Java 21 and Maven 3.9.9 in the backend image, PostgreSQL 16.15, Python 3.12, and Node 22 in the frontend image. The frozen Markdown and OpenAPI contracts remain unchanged.

## Completed implementation

- The stateless FastAPI financial engine implements health and evaluation, Decimal annuity/DSCR calculations, twelve-month BASE/STRESS_15/STRESS_30 forecasts, deterministic scoring, risk factors, and financing alternatives.
- The Spring Boot backend implements Flyway migrations and deterministic synthetic seeds, JWT authentication, role checks, company isolation, all sixteen public OpenAPI operations, immutable application snapshots, persisted scores/decisions/history, optimistic workflow protection, and real HTTP integration with the financial engine.
- The React frontend implements protected entrepreneur and bank-officer routes, financial editing, products, application workflows, the three-scenario Business Twin, explainable scoring, offers, acceptance, and simulated issuance. Runtime mocks are disabled.
- Docker Compose describes PostgreSQL, the engine, backend, and frontend with service health dependencies and persistent PostgreSQL storage.

## Executed verification

| Check | Result |
|---|---|
| Financial engine `pytest -q` | 95 passed; one upstream Starlette/AnyIO deprecation warning |
| Backend Maven tests in the Java 21 build image | 33 discovered; 13 passed and 20 database suites skipped in the isolated image build; no failures or errors |
| Frontend Vitest workflow suite | 19 passed in one test file |
| Frontend ESLint | Passed |
| Frontend clean install and production build | `npm ci` completed; Vite built 3,685 modules. The 1.58 MB main chunk produces a size warning |
| Docker Compose services | PostgreSQL, financial engine, backend, and frontend built, started, and reported healthy |
| Real-service API/OpenAPI acceptance suite | Passed all sixteen frozen public operations and scenarios A-E against the Compose PostgreSQL/backend/engine stack |
| Concurrent workflow checks | Passed: concurrent submit and conflicting decisions persisted one valid outcome |
| Persistence scenario F | Passed after actual restart of all four Compose services; applications, snapshots, scores, decisions, and history remained intact |
| Engine outage/recovery | Passed: outage returned 503 `ENGINE_UNAVAILABLE`, preserved CHECKING and snapshot, created no score; retry reused the snapshot and created exactly one score/review transition |
| Browser smoke | Passed entrepreneur and bank login, authenticated dashboards, and a live Business Twin calculation; BASE/STRESS_15/STRESS_30, DSCR 2.81, alternatives, enabled application action, and no browser console errors |

The acceptance runner independently checks PMT and DSCR, cash-flow conservation, stress ordering, simulation side-effect freedom, role restrictions, cross-company denial, snapshot immutability, status histories, persisted decisions, invalid transitions, and response validation against `contracts/public-api.yaml`.

## Open release checks

- The Maven build image intentionally has no Docker socket, so its two database test classes skip there. The repository acceptance suite covers the real PostgreSQL/backend/engine integration in Compose, including persistence and failure recovery.
- The frontend production bundle is 1.58 MB before gzip. Route-based splitting would improve initial loading if this demo becomes a deployed product.
- Recharts 2.15.1 and ESLint 9.20.1 emitted upstream end-of-support warnings. The application builds and tests successfully with the pinned versions.

## Git checkpoints

- `7483943` — financial engine implementation
- `3c20da2` — real API/database and resilience acceptance runners
- `4e42da3` — reviewed backend integration
- `984b6e1` — backend Swagger bearer authorization
- `2b2f463` — verified frontend integration
- `68b1fbf` — final integration verification, dependency patch, and delivery documentation

## Resume and verification commands

The intended complete startup remains:

```sh
docker compose up --build
```

For local component checks:

```sh
cd financial-engine
python -m pytest -q

cd ../backend
./mvnw test
./mvnw package

cd ../frontend
npm ci
npm run lint
npm test -- --run
npm run build
```

With PostgreSQL, the engine, and backend running, execute:

```sh
python scripts/verify_e2e.py
python scripts/verify_e2e.py --verify-persistence
python scripts/verify_resilience.py --phase outage
python scripts/verify_resilience.py --phase recovery
```

On macOS/Linux, `scripts/verify-compose.sh` orchestrates the complete Compose verification. On Windows, use `scripts/verify-compose.ps1`. JSON evidence is written under the ignored `verification-results/` directory.
