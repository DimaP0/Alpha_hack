# Frozen contract audit

The supplied shared contract and two OpenAPI documents are preserved unchanged.
The initial workspace had no application, dependencies, configuration or Git history.
Both optional frontend and engine specifications were found alongside the supplied files.

## Clarifications applied using the specified precedence

- Public `LoanParameters.upliftStartMonth` specifies minimum 1 but omits maximum 12. The shared business rules and internal schema require 1–12, enforced by backend and frontend.
- The state diagram's illustrative arrow from NEEDS_INFO to DRAFT conflicts with the detailed prose and endpoint guards. Editing keeps NEEDS_INFO; resubmit moves through CHECKING to UNDER_REVIEW.
- Generic application “CRUD” in the request does not introduce DELETE: the frozen API has create, read and update operations only.
- The YAML response lists omit 404/422 in some places. The shared error rules permit these statuses where appropriate; response envelopes remain ApiError.
- The public view contains only the latest financialSnapshot and scoring. Earlier submissions remain immutable database rows; no unapproved history endpoint is added.
- Financial-engine TASK specifies unrounded DSCR for scoring thresholds and HALF_UP output rounding. This refines, without changing, the shared formulas.
- CHECKING retries reuse the already captured pending submission, preserving its input; financial changes require the documented NEEDS_INFO/resubmit workflow.

This is a local Docker-based application. Hosted Sites infrastructure, GitHub publication, access grants and remote tag pushes from the example runbook were not part of the user's requested deployment destination and are not performed.
