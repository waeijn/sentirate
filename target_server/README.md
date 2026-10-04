# Target Server (Mock Upstream)

This folder contains the simulated **Target Server** (the protected backend). 

Currently, the `SentiRate` middleware handles traffic simulation directly via its own API router (`/api/request/{ip}`). However, as the project scales, you can configure the middleware to act as a true **Reverse Proxy**. 

When that happens, the middleware will forward admitted traffic to this standalone Target Server over HTTP.

## Future Upgrades
By keeping this server isolated, you can easily upgrade it in the future to simulate real-world conditions for your defense demonstration:
- Artificial CPU load (to show the server struggling under DDoS)
- Database queries (to show DB pool exhaustion)
- Fake authentication endpoints (to simulate credential stuffing targets)
