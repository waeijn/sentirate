# Live Defense Guide: Target PC

This guide is for the **Target Machine** during a two-device physical network demonstration.
The Target PC is responsible for hosting the Redis Database, the FastAPI Middleware, and the React Dashboard.

## Prerequisites

1. Ensure Docker Desktop is running.
2. Ensure both the Attacker PC and Target PC are connected to the **exact same Wi-Fi network**.
3. Open PowerShell and run `ipconfig`. Find your **IPv4 Address** and give it to the Attacker.

---

## Option 1: Automated Start (Recommended)

You can start all services simultaneously using the automated PowerShell script.

1. Open PowerShell in the project root directory.
2. Run the script:

   ```powershell
   .\start_all.ps1
   ```

   _(This script uses relative paths and will automatically open separate windows for Redis, the Backend, and the Frontend)._

---

## Option 2: Manual Start (Fallback)

If you prefer to start the services manually to monitor their specific terminal outputs, open **three separate PowerShell windows** and run the following commands:

### Window 1: Start Redis Database

```powershell
docker start rate-limiter-redis
```

### Window 2: Start Backend Middleware (FastAPI)

```powershell
# Navigate to the backend folder
cd dashboard\backend

# Start the Uvicorn server using Poetry (Binds to 0.0.0.0 automatically)
poetry run python main.py
```

_Note: The backend must be running for the dashboard to receive data._

### Window 3: Start Frontend Dashboard (React)

```powershell
# Navigate to the frontend folder
cd dashboard\frontend

# Start the Vite development server
npm run dev
```

---

## Viewing the Dashboard

Once the services are running, open your web browser and navigate to:
`http://localhost:5173`

The dashboard will now wait passively. When the Attacker PC begins running their Locust scripts over the Wi-Fi, the metrics and logs on the dashboard will light up in real-time.
