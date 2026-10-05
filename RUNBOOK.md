# SentiRate Operations Runbook

This runbook provides the standard operating procedures for starting, stopping, and troubleshooting the SentiRate Adaptive API Rate Limiting Middleware.

---

## 1. Quick Start & Stop (Automated)

The easiest way to operate the system is via the included PowerShell automation scripts. These scripts use relative paths and will work on any Windows machine.

### Starting the System

1. Open PowerShell in the project root directory.
2. Run the start script:

   ```powershell
   .\start_all.ps1
   ```

   _This will automatically launch the Redis Docker container, the FastAPI backend (Port 8050), and the React frontend (Port 5173)._

### Stopping the System

To cleanly shut down all services and prevent orphan background processes:

1. Open PowerShell in the project root directory.
2. Run the stop script:

   ```powershell
   .\stop_all.ps1
   ```

---

## 2. Manual Startup (Fallback)

If the automation scripts fail, you can manually start the services across three separate terminal windows:

**Terminal 1: Redis**

```powershell
docker start rate-limiter-redis
```

**Terminal 2: Backend (FastAPI)**

```powershell
cd dashboard\backend
poetry run python main.py
```

**Terminal 3: Frontend (React)**

```powershell
cd dashboard\frontend
npm run dev
```

---

## 3. Traffic Generation (Testing)

To simulate attacks and test the middleware, use the Locust framework.

1. Navigate to the traffic generation directory:

   ```powershell
   cd experiments\traffic_generation
   ```

2. Reset the backend memory before a test:

   ```powershell
   curl.exe -X DELETE http://localhost:8050/api/clients
   ```

3. Launch a specific attack profile (e.g., Suspicious):

   ```powershell
   poetry run locust -f locust_scripts\locust_scenarios.py --host http://localhost:8050 --headless -u 250 -r 10 -t 3m SuspiciousUser
   ```

---

## 4. Common Troubleshooting

### Error: "Port 8050 is already in use"

- **Cause:** The backend crashed or a previous instance of Uvicorn wasn't shut down properly.
- **Fix:** Run `.\stop_all.ps1` to forcefully kill any lingering processes on Port 8050.

### Error: "Could not connect to Redis"

- **Cause:** Docker Desktop is not running, or the container was deleted.
- **Fix:** Ensure Docker Desktop is open. If the container was deleted, recreate it:

  ```powershell
  docker run -d --name rate-limiter-redis -p 6379:6379 redis:alpine
  ```

### Error: Dashboard UI is blank / Metrics aren't updating

- **Cause:** The backend server is not running, or CORS origins are misconfigured.
- **Fix:** Ensure the backend is running (`http://localhost:8050/docs`). If accessing the dashboard from another device on the network, ensure `DASHBOARD_HOST=0.0.0.0` is set in the backend environment.
