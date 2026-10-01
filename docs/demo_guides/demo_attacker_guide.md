# Live Defense Guide: Attacker PC

This guide is for the **Attacker Machine** during a two-device physical network demonstration.
The Attacker PC does not need to run Docker, the backend, or the dashboard. It only generates traffic.

## Prerequisites

1. Ensure both the Attacker PC and Target PC are connected to the **exact same Wi-Fi network**.
2. Ask the Lead Programmer (Target PC) for their IPv4 Address (e.g., `192.168.1.50`).
3. Open this file in an editor (like VSCode or Notepad), press `Ctrl + H` (Find and Replace), and replace `YOUR_TARGET_IP` with their actual IP address.

---

## 1. Navigate to the Workspace

Open PowerShell and navigate to the traffic generation directory:

```powershell
cd experiments\traffic_generation
```

---

## 2. Run Isolated Normal Traffic

```powershell
# Step A: Reset the Target's backend memory
curl.exe -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Normal profile (3 minutes, 250 users)
poetry run locust -f locust_scripts\locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m NormalUser
```

---

## 3. Run Isolated Bursty Traffic

```powershell
# Step A: Reset backend memory
curl.exe -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Bursty profile (3 minutes, 250 users)
poetry run locust -f locust_scripts\locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m BurstyUser
```

---

## 4. Run Volumetric Attack (Suspicious)

```powershell
# Step A: Reset backend memory
curl.exe -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Suspicious profile (3 minutes, 250 users)
poetry run locust -f locust_scripts\locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m SuspiciousUser
```

---

## 5. Run Mixed Trial (All Profiles Concurrently)

```powershell
# Step A: Reset backend memory
curl.exe -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Mixed Traffic simulation (Leaves off profile name to run all)
poetry run locust -f locust_scripts\locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m
```
