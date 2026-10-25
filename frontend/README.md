# Frontend

Russian responsive entrepreneur and bank-officer interfaces for ALFA BUSINESS NAVIGATOR. All data is synthetic; this is not a real bank offer or production banking application.

## Run

From the repository root: `docker compose up --build` and open `http://localhost:5173`.

Standalone frontend development:

```sh
npm ci
# Copy .env.example to .env.local; BACKEND_URL=http://localhost:8080
npm run dev
```

Backend must be running. All browser requests use `/api/v1`; the Vite server alone resolves `BACKEND_URL`. No runtime mocks exist. `VITE_USE_MOCKS=false` is documented for deployment compatibility and cannot enable a mock layer.

## Checks

```sh
npm run build
npm test -- --run
npm run lint
```

Build includes strict TypeScript. Component tests exercise login/roles, financial editing/validation, Twin and application mutations, officer decisions, acceptance and API errors. Test fixtures are test-only. A successful component test is not a claim that Docker or real-backend E2E was exercised.

Demo users: `owner@demo.local` and `bank@demo.local`, password `Demo123!`. These published synthetic credentials are **not for production**.
