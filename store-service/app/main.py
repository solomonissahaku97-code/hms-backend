"""Store Service - FastAPI Application."""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routes import api_router

settings = get_settings()

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
    logger.info("Starting store service", env=settings.env)
    if settings.env == "development":
        await init_db()
        logger.info("Database tables created")
    yield
    logger.info("Shutting down store service")


app = FastAPI(
    title="HMS Store Service",
    description="Store & Inventory microservice — stock items, batches, suppliers, requests, transfers",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "OK", "service": "store-service", "version": "1.0.0"}


@app.get("/", tags=["Root"])
async def root():
    return {"service": "store-service", "version": "1.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
