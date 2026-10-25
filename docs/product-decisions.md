# Product and UX decisions

## Job to be done

A small-business owner needs to understand whether financing is affordable before applying, and then follow a transparent application process. A bank officer needs the submitted financial snapshot, transparent risk factors, and an explicit place to record a human decision.

The scenario-based Business Twin makes the cash impact of a proposed investment visible over 12 months. The owner can compare BASE, STRESS_15 and STRESS_30 without creating applications for every experiment. All payment, DSCR, scores and alternatives come from the Python engine through the public backend API; the browser never calculates them.

## Three core UX choices

1. Separate prediction from decision. The algorithm recommendation is labelled explicitly; only the backend OFFERED state exposes offer acceptance. Alternative financing cards are simulations, never bank offers. Every page carries the synthetic-demo notice.
2. Preserve context and explain actions. Application details show financial inputs, score factors, the latest submitted snapshot and dated status history. NEEDS_INFO links to the finance editor and exposes resubmission. CHECKING exposes safe retry for the owner after engine failure. A 409 refreshes authoritative server state.
3. Avoid stale financial advice. Changing a Twin input immediately removes previous results and disables draft creation, cancels the outstanding fetch, and debounces recalculation for 300 ms. A generation guard prevents late results overwriting newer inputs. Tables supplement charts so exact negative balances are available without visual interpretation.

## Architecture and interaction

- React 18, strict TypeScript, Ant Design, TanStack Query, React Router and Recharts.
- Browser requests only relative `/api/v1` routes. Vite forwards `/api` to configurable `BACKEND_URL` (`http://backend:8080` in Docker, `http://localhost:8080` for local development).
- JWT uses sessionStorage for this demo. Session identity and role are checked through `/auth/me`; 401 clears auth and cached customer data. This storage choice is not a production-security claim.
- Financial editing replaces exactly 12 sequential unique months; money is validated as a nonnegative safe integer. Read-only company checks and credit-history properties never enter the update payload.
- Status and offer data remain server-owned. Mutations invalidate related query lists; application detail refetches on entry, action completion/error and CHECKING polling.
- Runtime includes no mock transport. Fixtures exist only in component tests.

## Honest model limits

The forecast uses the final three historical months as its baseline, constant operating expenses and user-supplied uplift assumptions; it does not model seasonality, tax systems or real credit bureaus. DSCR excludes the hoped-for uplift. Loan proceeds and the investment offset at month zero. The synthetic deterministic score is not a trained credit model and provides no promise of real approval. The officer's decision and disbursement are demonstration actions; no money moves.

## Frontend verification

Run from `frontend`: `npm ci`, `npm run build`, `npm test -- --run`, `npm run lint`.
Component tests use isolated fetch responses to verify actual form handlers, routing, request DTOs, server-status refresh, stale-result suppression, engine failures and all three officer decisions. They are not live backend E2E tests. The project integration suite separately validates the real backend and persistence.

For local development copy `frontend/.env.example` to `frontend/.env.local`, start the backend and run `npm run dev`. Docker uses the root Compose configuration and exposes the same Vite port 5173.
