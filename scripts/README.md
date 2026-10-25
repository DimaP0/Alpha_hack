# Acceptance verification

These checks call real HTTP endpoints and inspect actual PostgreSQL rows. They create synthetic applications; they do not truncate tables or reset existing data. Company financial inputs are restored after the update scenario (the version counter still advances).

## Docker Compose (PowerShell)

```powershell
pwsh -File scripts/verify-compose.ps1
```

This builds and starts the application, runs A–E through every public operation, restarts the containers and verifies F, injects an engine outage, recovers it, and exercises simultaneous submissions and conflicting decisions. The verification container talks over the private Compose network, so PostgreSQL and engine ports remain unpublished. JSON evidence is written to `verification-results/`.

## Docker Compose (macOS/Linux)

```bash
scripts/verify-compose.sh
```

This runs the same sequence using the private Compose network and saves JSON evidence under `verification-results/YYYY-MM-DD/`. Set `VERIFY_RESULTS_DIR` to choose another relative path under `verification-results/`; absolute paths and `..` components are rejected. If the outage check fails or the script is interrupted after stopping the engine, its exit handler starts and waits for `financial-engine` only.

## Existing local services

Use Python 3.12 in a virtual environment and install `scripts/requirements.txt`. Provide the database DSN of a dedicated demo/test database. Default local port 55432 is for the isolated verification cluster used during development.

```powershell
python scripts/verify_e2e.py --base-url http://localhost:8080 --database-url postgresql://alfa@127.0.0.1:55432/alfa
# Restart the project database and backend, then:
python scripts/verify_e2e.py --verify-persistence --report verification-results/persistence-report.json
# Stop the project's financial engine, then:
python scripts/verify_resilience.py --phase outage
# Start its financial engine, then:
python scripts/verify_resilience.py --phase recovery
python scripts/verify_resilience.py --phase concurrency
```

`--verify-persistence` compares saved evidence but does not perform a restart itself. Report a restart test only if a real restart was actually performed. Local process restart does not prove Docker container/volume behavior.

All responses are validated against the unchanged public YAML, including nested DTOs and nullable fields. Independent Decimal calculations check PMT and DSCR; every forecast point is checked for cash-flow conservation. SQL checks cover statuses, history, immutable snapshots, scores, and uniqueness under retry/concurrency.
