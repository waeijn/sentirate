# ADAPTIVE API RATE LIMITING USING HEURISTIC PATTERN CLASSIFICATION AND TOKEN BUCKET OPTIMIZATION

## Project Overview

This repository contains the implementation of a middleware system designed to provide adaptive, behavior-aware rate limiting for organizations currently relying on static, fixed-threshold rate limiting. Static thresholds cannot distinguish between legitimate traffic spikes and automated abuse, forcing a trade-off between service availability and security. This system addresses that gap by using **Heuristic Pattern Classification** to distinguish between human-like and automated (bot-like) traffic patterns in real time, then dynamically optimizing **Token Bucket** parameters in response.

## Key Features

- **Heuristic Classification Engine:** Categorizes API traffic into normal, bursty, and suspicious profiles based on request rate, interval regularity (jitter), and burst persistence.
- **Dynamic Parameter Optimization:** Automatically adjusts the Token Bucket refill rate ($r$) and bucket capacity ($b$) based on real-time classification output.
- **Dynamic Blocking / Enforcement:** Traffic classified as anomalous is throttled or blocked via standard HTTP 429 (Too Many Requests) responses, applied dynamically based on classification rather than a static rule.
- **Reverse Proxy Implementation:** Developed as a middleware layer using FastAPI to decouple security/rate-limiting logic from core application business logic, allowing it to sit in front of any API without modifying the underlying service.

## System Design

The system follows an **Input–Process–Output (IPO)** framework:

1. **Input:** API traffic metadata, timing intervals, and initial rate-limiting configurations.
2. **Process:** Real-time monitoring, heuristic-based behavioral classification, and dynamic Token Bucket parameter adjustment.
3. **Output:** Optimized request acceptance/rejection decisions, performance reports, and classification accuracy metrics (including False Negative Rate and request latency across traffic profiles).

## Evaluation

The system is evaluated against **ISO/IEC 25010** software quality standards, with emphasis on classification accuracy (FNR) and performance (request latency) across multiple traffic profiles (normal, bursty, and suspicious/malicious).

## License

This project is for academic purposes as part of an undergraduate research study at University of Cabuyao. Distributed under the MIT License.
