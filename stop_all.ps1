# stop_all.ps1
# Neatly shuts down the Redis container and kills the processes running the backend and frontend.

Write-Host "Stopping SentiRate services..." -ForegroundColor Cyan

# 1. Stop Redis Container
Write-Host "Stopping Redis container..." -ForegroundColor Yellow
docker stop rate-limiter-redis

# Function to kill a process by its port
function Kill-ProcessByPort {
    param ([int]$Port, [string]$ServiceName)
    
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connection) {
        $pidToKill = $connection.OwningProcess
        Write-Host "Stopping $ServiceName (Port $Port, PID $pidToKill)..." -ForegroundColor Yellow
        # Use taskkill /T to kill the process tree (parent and all child workers)
        taskkill /F /PID $pidToKill /T | Out-Null
        Write-Host "$ServiceName stopped." -ForegroundColor Green
    } else {
        Write-Host "$ServiceName is not running on port $Port." -ForegroundColor DarkGray
    }
}

# 2. Stop Target Server (Port 8000)
Kill-ProcessByPort -Port 8000 -ServiceName "Target Server"

# 3. Stop Backend (Port 8050)
Kill-ProcessByPort -Port 8050 -ServiceName "Backend (FastAPI)"

# 3. Stop Frontend (Port 5173)
Kill-ProcessByPort -Port 5173 -ServiceName "Frontend (React/Vite)"

# 4. Stop Locust (Port 8089) just in case it was left running
Kill-ProcessByPort -Port 8089 -ServiceName "Locust (Traffic Generator)"

Write-Host ""
Write-Host "All SentiRate services have been successfully shut down!" -ForegroundColor Green
Write-Host "You may safely close any leftover empty terminal windows." -ForegroundColor White
Start-Sleep -Seconds 3
