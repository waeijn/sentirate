# start_all.ps1
# Run this from C:\adaptive-api-rate-limiter

# 1. Redis
docker start rate-limiter-redis

# 2. Middleware (Backend API)
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd C:\adaptive-api-rate-limiter\dashboard\backend; C:\adaptive-api-rate-limiter\.venv\Scripts\python.exe main.py'

# 3. Frontend (React UI)
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd C:\adaptive-api-rate-limiter\dashboard\frontend; npm run dev'

# Wait for backend to be ready
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "All services starting." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Reset state:" -ForegroundColor White
Write-Host "     Invoke-RestMethod -Method DELETE -Uri http://localhost:8050/api/clients" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Start Locust (Distributed Master/Worker):" -ForegroundColor White
Write-Host "     cd C:\adaptive-api-rate-limiter\experiments\traffic_generation\locust_scripts" -ForegroundColor Yellow
Write-Host "     locust -f locust_scenarios.py --host=http://localhost:8050 --master" -ForegroundColor Green
Write-Host "     (Open another terminal, go to the same folder, and run this 2-4 times:)" -ForegroundColor Yellow
Write-Host "     locust -f locust_scenarios.py --worker" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Open Locust UI AFTER starting Locust:" -ForegroundColor White
Write-Host "     http://localhost:8089" -ForegroundColor Yellow