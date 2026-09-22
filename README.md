# SentiRate: Adaptive API Rate Limiting

> **Thesis Title:** Adaptive API Rate Limiting Using Heuristic Pattern Classification and Token Bucket Optimization

![SentiRate Logo](dashboard/frontend/public/logo.png)

## Project Overview
This repository contains **SentiRate**, a lightweight Application Programming Interface (API) middleware designed to provide adaptive security for Micro, Small, and Medium Enterprises (MSMEs). 

The system addresses the gap in traditional static rate limiting by utilizing **Heuristic Pattern Classification** to distinguish between human-like and robotic traffic patterns in real-time. By dynamically optimizing **Token Bucket** parameters, the middleware ensures high service availability for legitimate users while instantly mitigating automated abuse (e.g., volumetric attacks, web scrapers) with minimal processing delay.

## Key Features
* **Heuristic Classification Engine:** Categorizes API traffic into `normal`, `bursty`, and `suspicious` profiles based on request rate ($\lambda$), interval regularity ($\sigma$), and burst persistence.
* **Dynamic Parameter Optimization:** Automatically adjusts the Token Bucket refill rate ($R$) and bucket capacity ($C$) based on real-time classification output.
* **Inline Hardware Fast Gate:** A 1-second strict rolling window that instantly catches extreme floods (>30 RPS) before they reach the main algorithm, preventing race-condition bypasses.
* **Visual Traffic Dashboard:** A real-time React-based dashboard providing analytics on System Throughput, Request Acceptance Rate (RAR), and False Positive/Negative Rates.
* **Resource Efficiency:** Specifically designed for resource-constrained environments, prioritizing lightweight rule-based logic over computationally intensive machine learning models.

## System Architecture
The system follows an **Input-Process-Output (IPO)** framework, decoupling the security logic from core application business logic.

1. **Input:** Client API traffic, timing intervals, and HTTP Headers.
2. **Process:** Real-time sliding window aggregation (Redis), heuristic-based behavioral classification, and Lua-enforced Token Bucket deduction.
3. **Output:** Request admitted (`HTTP 200`) or blocked (`HTTP 429`), alongside system performance telemetry.

## Tech Stack
* **Backend Framework:** Python (FastAPI)
* **In-Memory Datastore:** Redis (Async Lua Scripting)
* **Frontend Dashboard:** React, TypeScript, Tailwind CSS, Vite
* **Real-time Comms:** Socket.IO
* **Stress Testing:** Locust (Distributed Traffic Generation)

---

## Getting Started

### Prerequisites
* Python 3.11+
* Node.js 20+
* Redis Server (Local or Docker)
* Poetry (Python Package Manager)

### 1. Starting the Middleware & Backend
```bash
cd dashboard/backend
poetry install
# Start the FastAPI + Socket.IO server on port 8050
WORKERS=4 DASHBOARD_HOST=0.0.0.0 DASHBOARD_PORT=8050 poetry run python main.py
```

### 2. Starting the Visual Dashboard
```bash
cd dashboard/frontend
npm install
npm run dev -- --host 0.0.0.0
```
*The dashboard will be available at `http://localhost:5173`.*

> **💡 Windows Users:** You can optionally run the `start_all.ps1` script in the root directory to automatically launch the Redis container, the FastAPI backend, and the React frontend simultaneously in separate windows.

---

## Thesis Evaluation (Traffic Generation)
To prove the efficacy of the algorithms, we provide custom Locust scripts simulating three distinct behavioral traffic profiles.

Navigate to the traffic generation directory:
```bash
cd experiments/traffic_generation
poetry install
```

**Run Isolated Tests:**
```bash
# 1. Legitimate Normal Traffic
locust -f locust_scripts/locust_scenarios.py --host http://localhost:8050 --headless -u 250 -r 10 -t 60s NormalUser

# 2. Legitimate Bursty Traffic
locust -f locust_scripts/locust_scenarios.py --host http://localhost:8050 --headless -u 250 -r 10 -t 60s BurstyUser

# 3. Malicious Suspicious Traffic
locust -f locust_scripts/locust_scenarios.py --host http://localhost:8050 --headless -u 250 -r 10 -t 60s SuspiciousUser
```

*Note: Ensure you reset the backend metrics via the Dashboard UI or API (`DELETE /api/clients`) between tests for accurate benchmarking.*

---

## Authors
* **John Wayne Landong**
* **Terrence John Manlapaz**
* **Bryan Cuellar**
* **Benedic Sarmiento**

*This project is for academic purposes as part of an undergraduate research study at the University of Cabuyao.*

## License
Distributed under the MIT License.
