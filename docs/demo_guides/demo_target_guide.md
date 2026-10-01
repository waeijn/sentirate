# Live Defense Guide: Target VM (Ubuntu)

This guide is for the **Target Virtual Machine** during a simulated network demonstration.
The Target VM is responsible for hosting the Redis Database, the FastAPI Middleware, and the React Dashboard.

## Prerequisites
1. Ensure both the Attacker VM and Target VM are on the same virtual network (e.g., Host-Only Adapter or Bridged Network).
2. Open the terminal and run `ip a` or `ifconfig`. Find your **IPv4 Address** and give it to the Attacker.

---

## Startup Sequence

You will need to open **three separate terminal windows** to run the services simultaneously.

### Window 1: Start Redis Database & Open Firewall
```bash
# Ensure the firewall allows incoming traffic on port 8050
sudo ufw allow 8050

# Start the Redis container
docker start rate-limiter-redis
```

### Window 2: Start Backend Middleware (FastAPI)
```bash
# Navigate to the backend folder
cd ~/sentirate/dashboard/backend

# Activate the virtual environment
source venv/bin/activate

# Start the server (Explicitly binding to 0.0.0.0 to allow network traffic)
DASHBOARD_HOST=0.0.0.0 DASHBOARD_PORT=8050 python main.py
```
*Note: The backend must be running for the dashboard to receive data.*

### Window 3: Start Frontend Dashboard (React)
```bash
# Navigate to the frontend folder
cd ~/sentirate/dashboard/frontend

# Start the Vite development server (Binding to 0.0.0.0)
npm run dev -- --host 0.0.0.0
```

---

## Viewing the Dashboard
Once the services are running, open your web browser (inside the Ubuntu VM or on the Host PC) and navigate to:
`http://localhost:5173` (or `http://<YOUR_UBUNTU_IP>:5173`)

The dashboard will now wait passively. When the Attacker VM begins running their Locust scripts, the metrics and logs on the dashboard will light up in real-time.
