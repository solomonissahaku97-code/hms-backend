"""Billing Service - FastAPI Application."""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routes import api_router

settings = get_settings()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("🚀 Starting billing service", env=settings.env)
    if settings.env == "development":
        await init_db()
        logger.info("✅ Database tables created")
    yield
    logger.info("🛑 Shutting down billing service")


app = FastAPI(
    title="HMS Billing Service",
    description="Billing microservice for HMS — Invoices, payments, NHIA claims, and financial reporting",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router)


# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "OK",
        "service": "billing-service",
        "version": "1.0.0",
    }


# Root
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "billing-service",
        "version": "1.0.0",
        "description": "Billing microservice for HMS",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
