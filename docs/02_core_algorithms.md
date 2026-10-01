# Core Algorithms: Heuristics & Token Bucket

This document outlines the theoretical and mathematical foundation of the SentiRate middleware. The system relies on a two-step pipeline: **Heuristic Pattern Classification** (to detect behavior) and **Dynamic Token Bucket Optimization** (to enforce limits).

---

## 1. Heuristic Pattern Classification Engine

Traditional rate limiters block users purely on volumetric counts. SentiRate introduces an intelligent background heuristic worker that evaluates a sliding window of request metadata to classify intent.

### 1.1 Evaluated Metrics

The engine extracts the following markers from a user's recent traffic:

1. **Request Rate ($\lambda$)**
   * *Definition:* The average number of requests per second within the current sliding window.
   * *Purpose:* Identifies the raw volume of traffic.

2. **Interval Regularity ($\sigma$)**
   * *Definition:* The standard deviation of the time intervals (in seconds) between consecutive requests.
   * *Purpose:* Differentiates between human traffic (high variance/jitter) and automated robotic traffic (highly consistent/low variance). Scripts firing in a loop typically yield $\sigma < 0.05$.

3. **Burst Frequency & Persistence**
   * *Definition:* The number of times the user has exceeded a safe threshold within a minute, and how long that burst persists.

### 1.2 The State Machine & Hysteresis

Based on the evaluated metrics, the IP address is classified into one of three states:
* 🟢 **Normal:** Human-like pacing, high interval variance, safe request volumes.
* 🟡 **Bursty:** High request volume but maintaining human-like interval variance. Typical of legitimate users loading heavy pages or reconnecting.
* 🔴 **Suspicious:** Dangerously high volume *or* robotic interval regularity ($\sigma$). Typical of volumetric DDoS attacks, brute-forcing, or web scrapers.

**Hysteresis (Streak Counter):** 
To prevent "flapping" (where a user constantly bounces between Normal and Suspicious due to network latency), the system employs a streak counter. An IP must exhibit suspicious behavior for consecutive evaluation ticks before a severe penalty is applied.

---

## 2. Dynamic Token Bucket Optimization

Once the heuristic engine classifies an IP, it immediately updates the parameters of the user's Token Bucket. 

### 2.1 The Token Bucket Algorithm
The token bucket algorithm controls bandwidth by adding tokens at a fixed rate ($R$) up to a maximum capacity ($C$). A request costs 1 token. If the bucket is empty, the request is dropped (HTTP 429).

### 2.2 Dynamic Parameter Shifting
Unlike traditional limiters where $C$ and $R$ are static, SentiRate alters them based on the user's classification:

| Classification | Bucket Capacity ($C$) | Refill Rate ($R$ per sec) | Description |
| :--- | :--- | :--- | :--- |
| **Normal** | `20` | `10` | Standard limits for typical browsing. |
| **Bursty** | `40` | `20` | Expanded limits to accommodate legitimate heavy usage. |
| **Suspicious** | `5` | `2` | Severely restricted limits to starve automated attacks while keeping the connection alive. |

---

## 3. Inline Hardware Fast Gate (Flood Protection)

While the Heuristic Engine provides deep, accurate analysis, it runs asynchronously. To prevent catastrophic, instantaneous volumetric floods (e.g., 500 requests in 0.1 seconds) from exploiting the background calculation delay, SentiRate employs an **Inline Fast Gate**.

* **Mechanism:** A hyper-fast Redis `INCR` and `TTL` counter evaluated inline on the hot path.
* **Threshold:** If an IP exceeds `30` requests within a single `1-second` window, the gate instantly overrides the background worker and forces the IP into the **Suspicious** state.
* **Result:** This ensures an absolute ceiling on traffic, combining the speed of a static limit with the long-term intelligence of the heuristic engine.
