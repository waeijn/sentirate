Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "   Adaptive API Rate Limiter - Thesis Showcase Evaluation" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting optimal load test: 250 Concurrent Users" -ForegroundColor Green
Write-Host "This user count is mathematically balanced to:"
Write-Host " 1. Push high throughput (>1,000 requests per second)"
Write-Host " 2. Prevent Locust load generator CPU starvation"
Write-Host " 3. Perfectly demonstrate the Heuristic Pattern Classification"
Write-Host ""
Write-Host "Test Duration: 60 seconds"
Write-Host "Distributed Workers: 4"
Write-Host "..."
Write-Host ""

python experiments/traffic_generation/run_distributed_test.py 250 60s 4

Write-Host ""
Write-Host "Showcase Complete! Review the aggregated metrics above." -ForegroundColor Green
Write-Host "Expected Results:"
Write-Host " - FNR (False Negative Rate): < 15% (representing the intentional 'cold-start' window)"
Write-Host " - Median Latency: < 25ms"
Write-Host " - Connection Drops: 0"
Write-Host "==============================================================" -ForegroundColor Cyan
