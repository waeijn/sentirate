# start_all.ps1
# This script uses relative paths and can be run from any directory.

# 1. Redis
Write-Host "Checking Docker..." -ForegroundColor Cyan
$dockerCheck = docker info 2>&1
if ($dockerCheck -match "error during connect") {
    Write-Host "ERROR: Docker Desktop is not running! Please open Docker Desktop manually, wait for the whale icon to turn green, and then run this script again." -ForegroundColor Red
    exit
}

$container = docker ps -a -q -f name="rate-limiter-redis"
if ($container) {
    Write-Host "Starting existing Redis container..." -ForegroundColor Yellow
    docker start rate-limiter-redis | Out-Null
} else {
    Write-Host "Creating new Redis container..." -ForegroundColor Yellow
    docker run -d --name rate-limiter-redis -p 6379:6379 redis:alpine | Out-Null
}

# 2. Target Server (Mock Upstream on Port 8000)
Write-Host "Starting Target Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-Command', "cd `"$PSScriptRoot\target_server`"; poetry run uvicorn main:app --port 8000"

# 3. Middleware (Backend API on Port 8050)
Start-Process powershell -ArgumentList '-Command', "cd `"$PSScriptRoot\dashboard\backend`"; poetry run python main.py"

# 3. Frontend (React UI)
Start-Process powershell -ArgumentList '-Command', "cd `"$PSScriptRoot\dashboard\frontend`"; npm run dev"

# 4. Traffic Generation (Locust)
Write-Host "Starting Locust Traffic Generator..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-Command', "cd `"$PSScriptRoot\experiments\traffic_generation\locust_scripts`"; poetry run locust -f locust_scenarios.py --host=http://localhost:8050"

# Wait for backend and Locust to be ready
Start-Sleep -Seconds 6

Write-Host ""
Write-Host "All services starting." -ForegroundColor Green
Write-Host "Opening web browsers..." -ForegroundColor Cyan

# Automatically open the Locust UI (Vite automatically opens the Dashboard)
Start-Process "http://localhost:8089" # Locust UI

Write-Host ""
Write-Host "Next step:" -ForegroundColor Cyan
Write-Host "  To reset state:" -ForegroundColor White
Write-Host "     Invoke-RestMethod -Method DELETE -Uri http://localhost:8050/api/clients" -ForegroundColor Yellow
Write-Host ""
