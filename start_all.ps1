# start_all.ps1
# Usage:
#   .\start_all.ps1          # Starts in standard HTTP mode
#   .\start_all.ps1 -Https   # Starts in secure HTTPS/SSL mode

param(
    [switch]$Https
)

$protocol = if ($Https) { "https" } else { "http" }
$backendUrl = "$protocol`://localhost:8050"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Starting SentiRate in $($protocol.ToUpper()) mode" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if ($Https) {
    $certsDir = Join-Path $PSScriptRoot "certs"
    $certFile = Join-Path $certsDir "cert.pem"
    $keyFile  = Join-Path $certsDir "key.pem"

    if (!(Test-Path $certFile) -or !(Test-Path $keyFile)) {
        Write-Host "SSL certificates missing. Generating local certificates..." -ForegroundColor Yellow
        & "$PSScriptRoot\generate_certs.ps1"
    } else {
        Write-Host "Using SSL certificates from $certsDir" -ForegroundColor Green
    }
}

# 1. Redis
Write-Host "Checking Docker..." -ForegroundColor Cyan
$dockerCheck = docker info 2>&1
if ($dockerCheck -match "error during connect") {
    Write-Host "ERROR: Docker Desktop is not running! Please open Docker Desktop manually, wait for the whale icon to turn green, and then run this script again." -ForegroundColor Red
    exit
}

$container = docker ps -a -q -f name="rate-limiter-redis" 2>$null
if ($container) {
    Write-Host "Cleaning up previous Redis container..." -ForegroundColor Yellow
    docker rm -f rate-limiter-redis | Out-Null
}
Write-Host "Starting fresh Redis container..." -ForegroundColor Yellow
docker run -d --rm --name rate-limiter-redis -p 6379:6379 redis:alpine | Out-Null

# 2. Target Server (Mock Upstream on Port 8000)
Write-Host "Starting Target Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-Command', "cd `"$PSScriptRoot\target_server`"; poetry run uvicorn main:app --port 8000"

# 3. Middleware (Backend API on Port 8050)
$backendCmd = if ($Https) {
    "`$env:USE_HTTPS='true'; cd `"$PSScriptRoot\dashboard\backend`"; poetry run python main.py"
} else {
    "`$env:USE_HTTPS='false'; cd `"$PSScriptRoot\dashboard\backend`"; poetry run python main.py"
}
Start-Process powershell -ArgumentList '-Command', $backendCmd

# 4. Frontend (React UI)
Set-Content -Path "$PSScriptRoot\dashboard\frontend\.env.local" -Value "VITE_BACKEND_TARGET=$backendUrl"
$frontendCmd = "cd `"$PSScriptRoot\dashboard\frontend`"; npm run dev"
Start-Process powershell -ArgumentList '-Command', $frontendCmd

# 5. Traffic Generation (Locust)
Write-Host "Starting Locust Traffic Generator ($backendUrl)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-Command', "cd `"$PSScriptRoot\experiments\traffic_generation\locust_scripts`"; poetry run locust -f locust_scenarios.py --host=$backendUrl"

# Wait for backend and Locust to be ready
Start-Sleep -Seconds 6

Write-Host ""
Write-Host "All services starting." -ForegroundColor Green
Write-Host "Opening web browsers..." -ForegroundColor Cyan

# Automatically open the Locust UI
Start-Process "http://localhost:8089"

Write-Host ""
Write-Host "Next step:" -ForegroundColor Cyan
Write-Host "  To reset state:" -ForegroundColor White
if ($Https) {
    Write-Host "     Invoke-RestMethod -SkipCertificateCheck -Method DELETE -Uri $backendUrl/api/clients" -ForegroundColor Yellow
} else {
    Write-Host "     Invoke-RestMethod -Method DELETE -Uri $backendUrl/api/clients" -ForegroundColor Yellow
}
Write-Host ""
