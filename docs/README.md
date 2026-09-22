# SentiRate Documentation

This folder contains the technical documentation and reference material for the SentiRate middleware.

## Technical Index

* **[01. System Architecture](./01_system_architecture.md)**
  Details the decoupled Input-Process-Output (IPO) model, the FastAPI reverse-proxy structure, and the Redis configurations (AOF, Lua scripting) used to guarantee $O(1)$ constant time complexity.

* **[02. Core Algorithms](./02_core_algorithms.md)**
  Explains the mathematical theory behind the Heuristic Pattern Classification Engine (Request Rate $\lambda$, Interval Regularity $\sigma$) and the Dynamic Token Bucket Parameter Shifting.

* **[03. API & WebSockets Reference](./03_api_and_websockets.md)**
  Documents the REST API endpoints and Socket.IO events used to broadcast real-time telemetry to the Visual Dashboard.

* **[04. Evaluation Methodology](./04_evaluation_methodology.md)**
  Provides the guidelines for executing synthetic load tests using Locust, including the modeling of Human-Computer Interaction (HCI) and Single-Page Application (SPA) burst patterns.

## Diagrams
* **[diagrams/](./diagrams/)** - Directory reserved for storing architecture flowcharts, state transition diagrams, and sequence diagrams.
