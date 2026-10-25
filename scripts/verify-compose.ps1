$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
function Invoke-Compose {
    & docker compose -f docker-compose.yml -f docker-compose.verify.yml @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed ($LASTEXITCODE)" }
}
Invoke-Compose up --build -d --wait
Invoke-Compose run --build --rm verification
Invoke-Compose restart postgres financial-engine backend frontend
Invoke-Compose up -d --wait
Invoke-Compose run --rm verification --base-url http://backend:8080 --verify-persistence --report verification-results/persistence-report.json
Invoke-Compose stop financial-engine
try {
    Invoke-Compose run --rm --entrypoint python verification scripts/verify_resilience.py --base-url http://backend:8080 --phase outage
} finally {
    Invoke-Compose start financial-engine
    Invoke-Compose up -d --wait
}
Invoke-Compose run --rm --entrypoint python verification scripts/verify_resilience.py --base-url http://backend:8080 --phase recovery
Invoke-Compose run --rm --entrypoint python verification scripts/verify_resilience.py --base-url http://backend:8080 --phase concurrency
Write-Output 'Compose E2E, restart persistence, engine outage recovery and concurrency passed.'
