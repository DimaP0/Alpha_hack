# Verification scenarios

All data are synthetic. A successful scoring response is a recommendation; only an authenticated bank officer can make a decision.

## Financial Engine automated coverage

Run `python -m pytest -q` from `financial-engine/` after installing its pinned requirements in a Python 3.12 virtual environment. The tests exercise the actual FastAPI application and pure financial functions:

- Annuity: zero/positive/tiny rates, half-up ties, large principal, invalid terms.
- DSCR: zero margin and denominator protection, exact thresholds 1.0/1.2/1.5/2.0; rounded display cannot change threshold classification.
- Scoring: boundaries 549/550/749/750; company age 11/12/23/24; negative-margin and late-payment caps; tax debt; exact cash-buffer boundary; inactive-company refusal; score clipping; reason codes and impacts.
- Forecast: three ordered scenarios, 12 months each, cash-flow identities, stress ordering, uplift timing, negative balances, minimum excluding opening cash, no loan-proceeds cash inflation, fractional-baseline convention.
- Alternatives: 100/80/60% candidates, product limits, deduplication, same term, no nested alternatives, risk followed by descending amount ordering.
- API: health, frozen YAML request/response validation, generated OpenAPI field/enum checks, all required fields, rejection of unknown fields and malformed/duplicate/nonconsecutive months, generic HTTP 500 without internal detail.
- Golden fixtures: fixed constant monthly input and backend seed input; simulation and applicationId evaluation are identical for the same inputs.

The fixture response is regression data, with independent assertions on financial outputs. The test suite does not assert final bank decisions or database persistence.

## Mandatory integrated acceptance

Start the complete stack with `docker compose up --build -d`. Use the documented synthetic accounts. Execute with mocks disabled and check real API payloads and PostgreSQL rows:

| Scenario | Actions | Required evidence |
| --- | --- | --- |
| A Approval | Create → submit → bank APPROVE → client accept → bank simulate disbursement | DRAFT/CHECKING/UNDER_REVIEW/OFFERED/ACCEPTED/SIMULATED_ISSUED history, immutable snapshot, persisted score, product-constrained offer, simulated issuance |
| B Rejection | Create → submit → bank DECLINE with reason | DECLINED, stored decision/comment/history, no offer acceptance |
| C More information | Submit → bank REQUEST_INFO → update finances → resubmit | NEEDS_INFO/CHECKING/UNDER_REVIEW, new score and snapshot, old snapshot preserved |
| D Isolation | Log in as two company owners and bank officer | Foreign read/edit/submit/accept denied; owners' lists isolated; banker can review both |
| E Snapshot integrity | Submit; record snapshot/score; update company finances; simulate | New simulation reflects edits, stored submitted snapshot/score unchanged; resubmission captures a new version |
| F Persistence | Record application, score, decision and history; restart containers | The same database records and values remain after restart with named volume |

Additional regressions: unauthorized access returns JSON 401/403; invalid transition returns 409; malformed payload cannot update data; repeated submits and decisions cannot duplicate final transitions; engine outage returns ENGINE_UNAVAILABLE with CHECKING retained and no fabricated score; retry after restoration completes review.

For financial consistency, compare the simulation response to the engine's seed fixture and the submitted scoring fields for identical inputs. Query snapshot/history counts, not only HTTP status. For Docker, record `docker compose ps`, service health, logs, and application availability. Actual execution results and environment limitations are recorded in the final delivery report; this document is an acceptance plan, not a claim that all integrated scenarios have passed.
