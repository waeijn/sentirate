# Live Defense Guide: Attacker VM (Kali Linux)

This guide is for the **Attacker Virtual Machine** during a simulated network demonstration. 
The Attacker VM does not need to run Docker, the backend, or the dashboard. It only generates traffic.

## Prerequisites
1. Ensure both the Attacker VM and Target VM are on the same virtual network (e.g., Host-Only Adapter or Bridged Network in VirtualBox/VMware).
2. Ask the Lead Programmer (Target VM) for their IPv4 Address (e.g., `192.168.56.101`).
3. Open this file in an editor, press `Ctrl + H` (Find and Replace), and replace `YOUR_TARGET_IP` with their actual IP address.

---

## 1. Navigate to the Workspace
Open your terminal and navigate to the traffic generation directory:
```bash
cd ~/sentirate/experiments/traffic_generation
```

---

## 2. Run Isolated Normal Traffic
```bash
# Step A: Reset the Target's backend memory
curl -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Normal profile (3 minutes, 250 users)
locust -f locust_scripts/locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m NormalUser
```

---

## 3. Run Isolated Bursty Traffic
```bash
# Step A: Reset backend memory
curl -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Bursty profile (3 minutes, 250 users)
locust -f locust_scripts/locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m BurstyUser
```

---

## 4. Run Volumetric Attack (Suspicious)
```bash
# Step A: Reset backend memory
curl -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Suspicious profile (3 minutes, 250 users)
locust -f locust_scripts/locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m SuspiciousUser
```

---

## 5. Run Mixed Trial (All Profiles Concurrently)
```bash
# Step A: Reset backend memory
curl -X DELETE http://YOUR_TARGET_IP:8050/api/clients

# Step B: Run Mixed Traffic simulation (Leaves off profile name to run all)
locust -f locust_scripts/locust_scenarios.py --host http://YOUR_TARGET_IP:8050 --headless -u 250 -r 10 -t 3m
```
