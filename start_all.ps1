# start_all.ps1
# Run this from C:\adaptive-api-rate-limiter

# 1. Redis
docker start rate-limiter-redis

# 2. Mock backend
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd C:\adaptive-api-rate-limiter\dashboard\backend; python mock_backend.py'

# 3. Middleware
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd C:\adaptive-api-rate-limiter\dashboard\backend; python main.py'

# 4. Frontend
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
Write-Host "  2. Start Locust:" -ForegroundColor White
Write-Host "     cd C:\adaptive-api-rate-limiter\experiments\traffic_generation\locust_scripts" -ForegroundColor Yellow
Write-Host "     locust -f locust_scenarios.py --host=http://localhost:8050" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Open Locust UI AFTER starting Locust:" -ForegroundColor White
Write-Host "     http://localhost:8089" -ForegroundColor Yellow