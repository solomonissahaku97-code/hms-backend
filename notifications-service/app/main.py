"""
HMS Notifications Service — FastAPI Application Entry Point.

This service runs independently and handles:
  - Receiving notification requests from HMS Backend
  - Persisting notifications to PostgreSQL
  - Queuing them for async delivery via Redis
  - Delivering via SMS, Email, In-App, or Push providers

Architecture:
  HMS Backend → [HTTP] → Notifications Service → [Redis Queue] → Worker → Provider
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.config import get_settings
from app.database import init_db, close_db
from app.logging_config import configure_logging
from app.routes.health import router as health_router
from app.routes.notifications import router as notifications_router
from app.services.queue import notification_queue

settings = get_settings()

# ── Structured Logging ─────────────────────────────────────────────────
configure_logging(debug=settings.DEBUG)
logger = structlog.get_logger()


# ── Application Lifespan ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # ── Startup ────────────────────────────────────────────────────
    logger.info(
        LogEvents.STARTUP,
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        port=settings.PORT,
    )

    # Create database tables
    await init_db()
    logger.info("database_tables_initialized")

    # Connect to Redis queue
    try:
        await notification_queue.connect()
        logger.info("redis_queue_connected")
    except Exception as e:
        logger.warning("redis_queue_connection_failed", error=str(e))

    yield

    # ── Shutdown ───────────────────────────────────────────────────
    logger.info(LogEvents.SHUTDOWN, service=settings.APP_NAME)
    await notification_queue.close()
    await close_db()


# ── FastAPI App ────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="HMS Notifications Microservice — handles SMS, Email, In-App, and Push notifications",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(notifications_router)


# ── Root ───────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }


# ── Direct run ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )
