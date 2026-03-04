from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import socketio

load_dotenv()

app = FastAPI(
    title="Adaptive Rate Limiter Dashboard API",
    description="Backend API for the Adaptive Rate Limiter Dashboard",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

socket_app = socketio.ASGIApp(sio, app)

from api_routes import router as api_router
from websocket_handler import register_socketio_events

app.include_router(api_router, prefix="/api", tags=["API"])
register_socketio_events(sio)

@app.get("/")
async def root():
    return {"message": "Adaptive Rate Limiter API", "version": "0.1.0", "status": "active"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("DASHBOARD_HOST", "localhost")
    port = int(os.getenv("DASHBOARD_PORT", 8050))
    uvicorn.run(
        "main:socket_app",
        host=host,
        port=port,
        reload=True,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )