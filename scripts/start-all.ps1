# FundamentalX - start all four services on Windows (PowerShell).
# Usage (from the project root):   powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
# Each service opens in its own window so you can read its logs. MySQL must already be running.

$root = Split-Path -Parent $PSScriptRoot

Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\backend-python'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --host 127.0.0.1 --port 8001" -WindowStyle Normal
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\backend-php'; php -S 127.0.0.1:8002 -t public public/index.php" -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\backend-node'; npm start" -WindowStyle Normal
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\frontend'; npm run dev" -WindowStyle Normal

Write-Host "Starting... open http://localhost:5173 in a few seconds."
Write-Host "Health check: http://localhost:4000/api/health"
