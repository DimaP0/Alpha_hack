#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

compose() {
  docker compose -f docker-compose.yml -f docker-compose.verify.yml "$@"
}

results_dir=${VERIFY_RESULTS_DIR:-"verification-results/$(date +%F)"}
case "$results_dir" in
  /*)
    echo "VERIFY_RESULTS_DIR must be a relative path under verification-results/ (absolute paths are not allowed)." >&2
    exit 2
    ;;
  verification-results|verification-results/*)
    ;;
  *)
    echo "VERIFY_RESULTS_DIR must be verification-results or a path beneath verification-results/." >&2
    exit 2
    ;;
esac
case "/$results_dir/" in
  */../*)
    echo "VERIFY_RESULTS_DIR cannot contain '..' path components." >&2
    exit 2
    ;;
esac
mkdir -p "$results_dir"

engine_stopped=0
restore_engine() {
  local status=$?
  trap - EXIT INT TERM
  if [[ "$engine_stopped" -eq 1 ]]; then
    echo "Restoring financial-engine after outage check..." >&2
    if ! compose up -d --wait financial-engine; then
      echo "Could not restore financial-engine; run: docker compose -f docker-compose.yml -f docker-compose.verify.yml up -d --wait financial-engine" >&2
      status=1
    fi
  fi
  exit "$status"
}
trap restore_engine EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

compose up --build -d --wait
compose run --build --rm verification \
  --base-url http://backend:8080 \
  --state "$results_dir/e2e-state.json" \
  --report "$results_dir/e2e-report.json"

compose restart postgres financial-engine backend frontend
compose up -d --wait
compose run --rm verification \
  --base-url http://backend:8080 \
  --verify-persistence \
  --state "$results_dir/e2e-state.json" \
  --report "$results_dir/persistence-report.json"

engine_stopped=1
compose stop financial-engine
compose run --rm --entrypoint python verification \
  scripts/verify_resilience.py \
  --base-url http://backend:8080 \
  --phase outage \
  --state "$results_dir/outage-state.json" \
  --report "$results_dir/outage-report.json"

compose up -d --wait financial-engine
engine_stopped=0
compose run --rm --entrypoint python verification \
  scripts/verify_resilience.py \
  --base-url http://backend:8080 \
  --phase recovery \
  --state "$results_dir/outage-state.json" \
  --report "$results_dir/recovery-report.json"
compose run --rm --entrypoint python verification \
  scripts/verify_resilience.py \
  --base-url http://backend:8080 \
  --phase concurrency \
  --report "$results_dir/concurrency-report.json"

echo "Compose E2E, restart persistence, engine outage recovery and concurrency passed."
echo "Evidence: $results_dir"
