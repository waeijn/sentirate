# ============================================
# Adaptive API Rate Limiter - Setup Script
# ============================================

Write-Host "Setting up Adaptive API Rate Limiter project structure..." -ForegroundColor Cyan

# Create root-level files
Write-Host ""
Write-Host "Creating root files..." -ForegroundColor Yellow

# Only create README.md if it doesn't exist
if (-Not (Test-Path "README.md")) {
    @"
# Adaptive API Rate Limiter

Adaptive API Rate Limiting Using Heuristic Pattern Classification and Token Bucket Optimization

## Overview

This project implements an adaptive API rate limiting middleware using heuristic pattern classification and token bucket optimization, specifically designed for MSMEs in the Philippines.

## Quick Start

See [Installation Guide](docs/user_guides/installation.md) for detailed setup instructions.

## Project Structure

- src/ - Core implementation
- tests/ - Test suite
- experiments/ - Research experiments
- evaluation/ - Performance evaluation
- notebooks/ - Jupyter notebooks for analysis
- dashboard/ - Real-time monitoring dashboard
- examples/ - Integration examples
- docs/ - Documentation

## Research Problems

1. Heuristic Pattern Classification (normal/bursty/suspicious)
2. Dynamic Token Bucket Optimization
3. Performance Impact Assessment (Latency & Throughput)
4. Effectiveness Evaluation (Request Acceptance, FPR, FNR)

## License

MIT License - See LICENSE file for details
"@ | Out-File -FilePath "README.md" -Encoding UTF8
    Write-Host "  [CREATED] README.md" -ForegroundColor Gray
} else {
    Write-Host "  [SKIPPED] README.md (already exists)" -ForegroundColor Gray
}

# Check if .gitignore exists (leader provided)
if (Test-Path ".gitignore") {
    Write-Host "  [FOUND] .gitignore (using existing file)" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] .gitignore not found! Please add it from your leader's template." -ForegroundColor Yellow
}

# Create .env.example
if (-Not (Test-Path ".env.example")) {
    @"
# ============================================
# Environment Variables Template
# ============================================

# Python Core Configuration
PYTHON_ENV=development
LOG_LEVEL=INFO

# Middleware Configuration
DEFAULT_RATE_LIMIT=100
DEFAULT_BUCKET_CAPACITY=50
DEFAULT_REFILL_RATE=10

# Heuristic Thresholds
NORMAL_RPS_THRESHOLD=10
BURSTY_RPS_THRESHOLD=50
SUSPICIOUS_RPS_THRESHOLD=100
INTERVAL_REGULARITY_THRESHOLD=0.2
BURST_PERSISTENCE_SECONDS=5

# Dashboard Configuration
DASHBOARD_HOST=localhost
DASHBOARD_PORT=8050
FRONTEND_PORT=5173

# Database Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Locust Configuration
LOCUST_HOST=http://localhost:8000
LOCUST_WEB_PORT=8089

# Logging Configuration
LOG_FILE_PATH=data/logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=5

# Performance Testing
ENABLE_PROFILING=false
PROFILE_OUTPUT_DIR=data/profiling

# Experimental Configuration
EXPERIMENT_OUTPUT_DIR=evaluation/results/raw_data
ENABLE_REAL_TIME_METRICS=true
"@ | Out-File -FilePath ".env.example" -Encoding UTF8
    Write-Host "  [CREATED] .env.example" -ForegroundColor Gray
} else {
    Write-Host "  [SKIPPED] .env.example (already exists)" -ForegroundColor Gray
}

# Create LICENSE file
if (-Not (Test-Path "LICENSE")) {
    @"
MIT License

Copyright (c) 2026 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"@ | Out-File -FilePath "LICENSE" -Encoding UTF8
    Write-Host "  [CREATED] LICENSE" -ForegroundColor Gray
} else {
    Write-Host "  [SKIPPED] LICENSE (already exists)" -ForegroundColor Gray
}

Write-Host "[SUCCESS] Root files processed" -ForegroundColor Green

# Create main directories
Write-Host ""
Write-Host "Creating directory structure..." -ForegroundColor Yellow

$directories = @(
    "src",
    "src/core",
    "src/algorithms",
    "src/algorithms/token_bucket",
    "src/algorithms/heuristics",
    "src/enforcement",
    "src/monitoring",
    "src/storage",
    "src/utils",
    "src/config",
    "tests",
    "tests/unit",
    "tests/integration",
    "tests/performance",
    "tests/fixtures",
    "experiments",
    "experiments/traffic_generation",
    "experiments/traffic_generation/locust_scripts",
    "experiments/synthetic_testing",
    "experiments/synthetic_testing/scenarios",
    "experiments/benchmarking",
    "experiments/parameter_tuning",
    "evaluation",
    "evaluation/metrics",
    "evaluation/analysis",
    "evaluation/visualization",
    "evaluation/results",
    "evaluation/results/raw_data",
    "evaluation/results/processed_data",
    "evaluation/results/figures",
    "evaluation/results/tables",
    "notebooks",
    "notebooks/utils",
    "data",
    "data/logs",
    "data/metrics",
    "data/experiments",
    "data/experiments/experiment_configs",
    "data/experiments/experiment_results",
    "data/cache",
    "data/cache/client_states",
    "dashboard",
    "dashboard/frontend",
    "dashboard/frontend/public",
    "dashboard/frontend/src",
    "dashboard/frontend/src/components",
    "dashboard/frontend/src/components/Dashboard",
    "dashboard/frontend/src/components/Simulation",
    "dashboard/frontend/src/components/Analysis",
    "dashboard/frontend/src/components/Common",
    "dashboard/frontend/src/pages",
    "dashboard/frontend/src/services",
    "dashboard/frontend/src/hooks",
    "dashboard/frontend/src/types",
    "dashboard/frontend/src/utils",
    "dashboard/frontend/src/styles",
    "dashboard/backend",
    "examples",
    "examples/fastapi_demo",
    "examples/flask_demo",
    "examples/configuration_examples",
    "deployment",
    "deployment/docker",
    "deployment/kubernetes",
    "deployment/scripts",
    "scripts",
    "docs",
    "docs/research",
    "docs/technical",
    "docs/user_guides",
    "docs/diagrams",
    "docs/diagrams/sequence_diagrams"
)

$createdCount = 0
$skippedCount = 0

foreach ($dir in $directories) {
    if (-Not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
        Write-Host "  [CREATED] $dir" -ForegroundColor Gray
        $createdCount++
    } else {
        $skippedCount++
    }
}

Write-Host "[SUCCESS] Directory structure processed - Created: $createdCount, Skipped: $skippedCount" -ForegroundColor Green

# Create __init__.py files for Python packages
Write-Host ""
Write-Host "Creating Python package files..." -ForegroundColor Yellow

$pythonPackages = @(
    "src",
    "src/core",
    "src/algorithms",
    "src/algorithms/token_bucket",
    "src/algorithms/heuristics",
    "src/enforcement",
    "src/monitoring",
    "src/storage",
    "src/utils",
    "src/config",
    "tests",
    "tests/unit",
    "tests/integration",
    "tests/performance",
    "tests/fixtures",
    "experiments",
    "experiments/traffic_generation",
    "experiments/traffic_generation/locust_scripts",
    "experiments/synthetic_testing",
    "experiments/synthetic_testing/scenarios",
    "experiments/benchmarking",
    "experiments/parameter_tuning",
    "evaluation",
    "evaluation/metrics",
    "evaluation/analysis",
    "evaluation/visualization",
    "notebooks/utils",
    "dashboard/backend"
)

$initCreated = 0
$initSkipped = 0

foreach ($pkg in $pythonPackages) {
    $initFile = Join-Path $pkg "__init__.py"
    if (-Not (Test-Path $initFile)) {
        New-Item -Path $initFile -ItemType File -Force | Out-Null
        $initCreated++
    } else {
        $initSkipped++
    }
}

Write-Host "[SUCCESS] Python packages initialized - Created: $initCreated, Skipped: $initSkipped" -ForegroundColor Green

# Create .gitkeep files for empty directories
Write-Host ""
Write-Host "Creating .gitkeep files..." -ForegroundColor Yellow

$gitkeepDirs = @(
    "data/logs",
    "data/metrics",
    "data/experiments/experiment_configs",
    "data/experiments/experiment_results",
    "data/cache/client_states",
    "evaluation/results/raw_data",
    "evaluation/results/processed_data",
    "evaluation/results/figures",
    "evaluation/results/tables",
    "docs/diagrams/sequence_diagrams"
)

$keepCreated = 0
foreach ($dir in $gitkeepDirs) {
    $gitkeepFile = Join-Path $dir ".gitkeep"
    if (-Not (Test-Path $gitkeepFile)) {
        New-Item -Path $gitkeepFile -ItemType File -Force | Out-Null
        $keepCreated++
    }
}

Write-Host "[SUCCESS] .gitkeep files created - Count: $keepCreated" -ForegroundColor Green

# Create README files for subdirectories
Write-Host ""
Write-Host "Creating README files..." -ForegroundColor Yellow

$readmeCount = 0

# Experiments README
if (-Not (Test-Path "experiments/README.md")) {
    @"
# Experiments

This directory contains all experimental code for generating synthetic traffic and running test scenarios.

## Structure

- traffic_generation/ - Locust scripts for synthetic traffic generation
  - Normal traffic patterns
  - Bursty legitimate traffic
  - Suspicious/abusive traffic
  - Mixed traffic scenarios

- synthetic_testing/ - Test scenario definitions and runners
  - Scenario implementations
  - Automated test execution

- benchmarking/ - Performance benchmarks
  - Static vs adaptive comparison
  - Baseline measurements
  - Performance comparisons

- parameter_tuning/ - Parameter optimization scripts
  - Heuristic threshold optimization
  - Token bucket parameter tuning
  - Sensitivity analysis

## Usage

See individual subdirectories for specific documentation.
"@ | Out-File -FilePath "experiments/README.md" -Encoding UTF8
    $readmeCount++
}

# Evaluation README
if (-Not (Test-Path "evaluation/README.md")) {
    @"
# Evaluation

This directory contains code for evaluating the performance of the adaptive rate limiter.

## Structure

- metrics/ - Evaluation metrics calculation
  - FPR, FNR, Precision, Recall
  - Latency, Throughput
  - Request Acceptance Rate
  - Confusion Matrix

- analysis/ - Data analysis scripts
  - Statistical analysis
  - Comparative analysis
  - Pattern analysis
  - Correlation analysis

- visualization/ - Data visualization
  - Plot generators
  - Research dashboard generation
  - Publication-ready charts
  - Interactive visualizations

- results/ - Experimental results (gitignored)
  - raw_data/ - Raw experimental data
  - processed_data/ - Processed datasets
  - figures/ - Generated figures
  - tables/ - Data tables

## Usage

1. Run experiments to generate data in results/raw_data/
2. Use analysis scripts to process data
3. Generate visualizations for thesis
"@ | Out-File -FilePath "evaluation/README.md" -Encoding UTF8
    $readmeCount++
}

# Notebooks README
if (-Not (Test-Path "notebooks/README.md")) {
    @"
# Jupyter Notebooks

Research analysis notebooks for the thesis.

## Notebooks

1. 01_exploratory_analysis.ipynb - Initial data exploration
2. 02_heuristic_validation.ipynb - Validate heuristic thresholds
3. 03_token_bucket_tuning.ipynb - Token bucket optimization
4. 04_performance_analysis.ipynb - Performance evaluation
5. 05_final_evaluation.ipynb - Final thesis results

## Setup

Install Jupyter:
  pip install jupyter notebook jupyterlab

Launch Jupyter:
  jupyter notebook

## Usage

Open notebooks in order (01 to 05) for complete analysis workflow.
"@ | Out-File -FilePath "notebooks/README.md" -Encoding UTF8
    $readmeCount++
}

# Data README
if (-Not (Test-Path "data/README.md")) {
    @"
# Data Directory

Storage for logs, metrics, and experimental data.

## Structure

- logs/ - Application logs
- metrics/ - Runtime metrics
- experiments/ - Experiment data
- cache/ - Cache data

Note: Files in this directory are gitignored except for .gitkeep and README files.
"@ | Out-File -FilePath "data/README.md" -Encoding UTF8
    $readmeCount++
}

# Dashboard README
if (-Not (Test-Path "dashboard/README.md")) {
    @"
# Dashboard

Real-time monitoring dashboard for the adaptive rate limiter.

## Components

- frontend/ - React + Vite + Tailwind CSS
- backend/ - FastAPI + WebSocket

## Development

Backend:
  cd dashboard/backend
  pip install -r requirements.txt
  python main.py

Frontend:
  cd dashboard/frontend
  npm install
  npm run dev

## Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:8050
- WebSocket: ws://localhost:8050/ws
"@ | Out-File -FilePath "dashboard/README.md" -Encoding UTF8
    $readmeCount++
}

# Examples README
if (-Not (Test-Path "examples/README.md")) {
    @"
# Examples

Integration examples showing how to use the adaptive rate limiter middleware.

## Available Examples

- fastapi_demo/ - FastAPI integration
- flask_demo/ - Flask integration
- configuration_examples/ - Configuration templates

## Usage

1. Choose your framework
2. Copy the example to your project
3. Customize configuration
4. Run and test
"@ | Out-File -FilePath "examples/README.md" -Encoding UTF8
    $readmeCount++
}

# Documentation README
if (-Not (Test-Path "docs/README.md")) {
    @"
# Documentation

Comprehensive documentation for the Adaptive API Rate Limiter project.

## Structure

- research/ - Thesis-related documentation
- technical/ - Technical specifications
- user_guides/ - User documentation
- diagrams/ - Visual documentation

## Contributing

When adding documentation:
1. Use Markdown format
2. Include code examples
3. Add diagrams to visualize concepts
4. Keep documentation up-to-date
"@ | Out-File -FilePath "docs/README.md" -Encoding UTF8
    $readmeCount++
}

Write-Host "[SUCCESS] README files created - Count: $readmeCount" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "PROJECT STRUCTURE SETUP COMPLETE!" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "SUMMARY:" -ForegroundColor Yellow
Write-Host "  [OK] Directory structure created" -ForegroundColor Green
Write-Host "  [OK] Python packages initialized" -ForegroundColor Green
Write-Host "  [OK] Documentation files created" -ForegroundColor Green
Write-Host "  [OK] Git tracking files added" -ForegroundColor Green

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Run: poetry install" -ForegroundColor White
Write-Host "  2. Run: cd dashboard/frontend && npm install" -ForegroundColor White
Write-Host "  3. Run: Copy-Item .env.example .env" -ForegroundColor White
Write-Host "  4. Edit .env with your configuration" -ForegroundColor White
Write-Host "  5. Start development!" -ForegroundColor White

Write-Host ""
Write-Host "DOCUMENTATION:" -ForegroundColor Yellow
Write-Host "  Installation Guide: docs/user_guides/installation.md" -ForegroundColor White
Write-Host "  Quick Start: docs/user_guides/quick_start.md" -ForegroundColor White
Write-Host "  Architecture: docs/technical/architecture.md" -ForegroundColor White

Write-Host ""
Write-Host "TIP: Run 'poetry shell' to activate the virtual environment" -ForegroundColor Yellow
Write-Host ""