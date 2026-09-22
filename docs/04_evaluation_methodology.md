# Evaluation Methodology

This document outlines the rigorous empirical testing procedures used to validate the SentiRate middleware. To prove the algorithmic efficiency of the system, a controlled, synthetic traffic simulation was engineered using Locust.

---

## 1. Traffic Generation Profiles (Locust)

Because the system is designed to detect *behavior* rather than static signatures, we developed three distinct traffic profiles to simulate empirical network behaviors and Human-Computer Interaction (HCI) standards. 

To eliminate bias and hardcoded predictability, **Stochastic Variance** (random mathematical distributions) was injected into the wait times of all scripts, ensuring no two tests were perfectly identical.

### 1.1 Normal Profile (Legitimate)
* **Goal:** Simulate standard human browsing behavior (reading, clicking, thinking).
* **Behavior:** Requests are separated by long, highly variable "think times" (e.g., 2 to 5 seconds). 
* **Expected Result:** High Interval Regularity ($\sigma > 0.15s$), low Request Rate ($\lambda$). System must classify as `Normal`.

### 1.2 Bursty Profile (Legitimate)
* **Goal:** Simulate modern Single-Page Applications (SPAs like React or Angular).
* **Behavior:** The script fires sudden, concurrent bursts of 5-10 API calls (simulating fetching images, user data, and posts simultaneously) followed by long periods of idle time.
* **Expected Result:** High Request Rate ($\lambda$) during bursts, but maintains high Interval Regularity ($\sigma$). System must classify as `Bursty Legitimate` and dynamically expand the Token Bucket to absorb the spike without dropping connections.

### 1.3 Suspicious-Abusive Profile (Malicious)
* **Goal:** Simulate volumetric attacks, HTTP Floods, and headless web scrapers.
* **Behavior:** The script executes sequential loops with zero human latency or "think time". 
* **Expected Result:** Dangerously high Request Rate ($\lambda > 25$) and mathematically rigid Interval Regularity ($\sigma < 0.15s$). System must classify as `Suspicious-Abusive` and lock the Token Bucket refill rate to 0.

---

## 2. Testing Procedure and Hardware Contention

To rigorously isolate the system's algorithmic efficiency from external network bottlenecks, the quantitative Locust stress tests were executed locally. 

### The 250-User Baseline
For the core classification and availability metrics, the testing baseline was constrained to **250 concurrent users** with a ramp-up rate of 10 users per second. This specific threshold yielded the most accurate representation of the heuristic engine's classification capabilities *before* local hardware contention (CPU maxing out on a single machine) artificially degraded the HTTP latency results.

Each trial was sustained for **3 minutes**. This duration was deliberately selected to ensure the rolling-average latency window (`LATENCY_MAXLEN = 2,000 requests`) entirely stabilized across all tiers.

---

## 3. Core Evaluation Metrics

The system's efficacy is graded on the following key performance indicators:

1. **Request Acceptance Rate (RAR):** The percentage of legitimate requests (Normal and Bursty profiles) successfully admitted by the middleware. A high RAR proves the system does not hinder business operations.
2. **False Positive Rate (FPR):** The proportion of legitimate users incorrectly classified and blocked as Suspicious. A perfect system maintains a 0.00% FPR.
3. **False Negative Rate (FNR):** The proportion of abusive requests incorrectly classified and admitted as Normal/Bursty. A low FNR proves the system successfully stops threats.
4. **Request Latency:** The processing overhead introduced by the middleware, measured dynamically via a rolling window to ensure $O(1)$ constant time complexity regardless of traffic volume.
