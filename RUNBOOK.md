# SentiRate Operations Runbook

This runbook provides the standard operating procedures for starting, stopping, and troubleshooting the SentiRate Adaptive API Rate Limiting Middleware.

---

## 1. Quick Start & Stop (Automated)

The easiest way to operate the system is via the included PowerShell automation scripts. These scripts use relative paths and will work on any Windows machine.

### Starting the System

1. Open PowerShell in the project root directory.
2. Run the start script:

   **Standard HTTP Mode (Default):**
   ```powershell
   .\start_all.ps1
   ```

   **Secure HTTPS / SSL Mode:**
   ```powershell
   .\start_all.ps1 -Https
   ```

   _This will automatically launch the Redis Docker container, the FastAPI backend (Port 8050), the mock upstream server (Port 8000), and the React frontend (Port 5173). In HTTPS mode, it automatically detects or generates local SSL certificates (`certs/cert.pem`, `certs/key.pem`) and upgrades WebSocket connections to `wss://`._

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
docker run -d --name rate-limiter-redis -p 6379:6379 redis:alpine
```
*(If a container named `rate-limiter-redis` already exists, run `docker start rate-limiter-redis` instead).*

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

## 4. Runtime Configuration Operations

SentiRate supports real-time, zero-downtime reconfiguration of rate limiter thresholds and token bucket parameters via both the Web Dashboard and the REST API.

### Via Visual Dashboard
1. Navigate to the **Configuration** page via the left sidebar.
2. A **Safety Warning Modal** will appear to prevent accidental changes to active traffic controls. Click **"Acknowledge & Proceed"**.
3. You can either:
   - Select a pre-configured profile: **Conservative** (strict), **Balanced** (default), or **Aggressive** (relaxed).
   - Adjust individual heuristic sliders (`Normal Traffic Max Rate`, `Bursty Max Rate`, `Suspicious Regularity Threshold`).
   - Modify Bucket Capacity and Refill Rate for `normal`, `bursty`, and `suspicious` profiles.
4. Click **"Apply Configuration"**. Changes are validated against mathematical safety invariants and atomically synced to Redis.

### Via REST API (CLI)
You can inspect and update parameters programmatically without accessing the UI:

- **Get Current Configuration:**
  ```powershell
  curl.exe -s http://localhost:8050/api/config | ConvertFrom-Json
  ```

- **Update Configuration (JSON Payload):**
  ```powershell
  $body = @{
      normal_rate_max     = 10.0
      bursty_rate_max     = 30.0
      suspicious_sigma    = 0.1
      normal_refill       = 10.0
      normal_capacity     = 20.0
      bursty_refill       = 20.0
      bursty_capacity     = 40.0
      suspicious_refill   = 2.0
      suspicious_capacity = 5.0
  } | ConvertTo-Json

  Invoke-RestMethod -Method Put -Uri "http://localhost:8050/api/config" -ContentType "application/json" -Body $body
  ```

---

## 5. Common Troubleshooting

### Error: "Port 8050 is already in use"

- **Cause:** The backend crashed or a previous instance of Uvicorn wasn't shut down properly.
- **Fix:** Run `.\stop_all.ps1` to forcefully kill any lingering processes on Port 8050.

### Error: "Could not connect to Redis" / "No such container: rate-limiter-redis"

- **Cause:** Docker Desktop is not running, or `.\stop_all.ps1` cleanly removed the container.
- **Fix:** Ensure Docker Desktop is open. Recreate the container with:

  ```powershell
  docker run -d --name rate-limiter-redis -p 6379:6379 redis:alpine
  ```

### Warning: "Your connection is not private" (HTTPS Mode)

- **Cause:** When starting with `.\start_all.ps1 -Https`, SentiRate generates a local self-signed certificate (`certs/cert.pem`).
- **Fix:** In your browser (Chrome/Edge/Safari), click **Advanced** → **Proceed to [address] (unsafe)**. No OpenSSL installation is required on client devices.

### Note on OpenSSL for Certificate Generation

- On Windows, `.\generate_certs.ps1` automatically searches for Git's bundled OpenSSL (`C:\Program Files\Git\usr\bin\openssl.exe`) or common Windows installation paths. If Git is installed, no manual OpenSSL installation or PATH modifications are needed.

### Error: Dashboard UI is blank / Metrics aren't updating

- **Cause:** The backend server is not running, or CORS origins are misconfigured.
- **Fix:** Ensure the backend is running (`http://localhost:8050/docs`). If accessing the dashboard from another device on the network, ensure `DASHBOARD_HOST=0.0.0.0` is set in the backend environment.
