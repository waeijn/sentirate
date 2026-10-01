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
