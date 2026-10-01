# API and WebSockets Reference

This document outlines the internal communication interfaces of the SentiRate middleware. It details how the React Dashboard interacts with the FastAPI backend to retrieve metrics, issue commands, and receive real-time telemetry.

---

## 1. REST API Endpoints

The system exposes RESTful endpoints for administrative actions and initial state fetching.

### `GET /api/status`
* **Description:** Retrieves the current overall health and metrics of the system.
* **Response (JSON):**
  ```json
  {
    "status": "active",
    "uptime_seconds": 1240,
    "total_requests": 36145,
    "blocked_requests": 140,
    "rar": 99.6,
    "throughput_rps": 25.4
  }
  ```

### `DELETE /api/clients`
* **Description:** Hard-resets the system. Clears all Redis keys, sliding windows, token buckets, and historical logs.
* **Usage:** Used primarily during testing and evaluation to ensure a clean slate between Locust simulation profiles.
* **Response:** `HTTP 200 OK`

---

## 2. Real-Time Telemetry (Socket.IO)

To prevent the frontend from aggressively polling the server (which would artificially inflate API load), the dashboard subscribes to Socket.IO events. The FastAPI backend acts as a broadcaster.

### Connection
* **Endpoint:** `ws://<HOST>:8050/socket.io/`
* **Transport:** WebSockets (with long-polling fallback)

### Emitted Events (Backend $\rightarrow$ Frontend)

#### `metrics_update`
Broadcasted periodically (e.g., every 1 second) to update the dashboard charts and stat cards.
* **Payload Structure:**
  ```json
  {
    "summary": {
      "total_requests": 5000,
      "blocked_requests": 250,
      "uptime_seconds": 120
    },
    "current_rps": 45.2,
    "rar": 95.0,
    "active_clients": 250,
    "latency_ms": 12.4
  }
  ```

#### `log_update`
Broadcasted whenever new enforcement actions are recorded by the Feedback Provider.
* **Payload Structure:** An array of the most recent audit logs (capped at `LOG_MAX=1000`).
  ```json
  [
    {
      "timestamp": 1700000000.123,
      "ip": "192.168.1.45",
      "action": "BLOCKED",
      "classification": "Suspicious-Abusive",
      "reason": "Request rate (45.2 req/s) exceeded Bursty threshold (25 req/s). Interval variance (0.02s) indicates mechanical behavior.",
      "tokens_remaining": 0.0
    }
  ]
  ```

---

## 3. Internal Lua Scripts

While not exposed via HTTP, the system utilizes an internal Redis API via Lua scripting for atomicity.

### `token_bucket.lua`
* **Purpose:** Evaluates if a request from an IP should be admitted.
* **Inputs:** `KEYS[1]` (Bucket Key), `ARGV[1]` (Capacity), `ARGV[2]` (Refill Rate), `ARGV[3]` (Current Timestamp).
* **Execution:** Calculates the time elapsed since the last request, adds appropriate tokens based on the `Refill Rate`, caps it at `Capacity`, and deducts 1 token. Returns `1` if successful, `0` if empty.
