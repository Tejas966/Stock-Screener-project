# Runs every automated test suite (requires MySQL running and .env configured).
$root = Split-Path -Parent $PSScriptRoot
$ErrorActionPreference = 'Continue'
Write-Host "== Python (pytest) ==";        Push-Location "$root\backend-python"; .\.venv\Scripts\python -m pytest; Pop-Location
Write-Host "== PHP (PHPUnit) ==";          Push-Location "$root\backend-php"; .\vendor\bin\phpunit; Pop-Location
Write-Host "== Node (node:test) ==";       Push-Location "$root\backend-node"; npm test; Pop-Location
Write-Host "== Frontend (Vitest) ==";      Push-Location "$root\frontend"; npm test; Pop-Location
