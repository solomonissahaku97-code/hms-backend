"""
Health Check Routes.

Used by Docker health checks and load balancers.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.services.queue import notification_queue
from app.config import get_settings
from app.schemas.notification import HealthResponse

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Service health check.

    Returns the status of the service, database, and Redis connections.
    Used by Docker health checks and monitoring tools.
    """
    # ── Database check ─────────────────────────────────────────────
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # ── Redis check ────────────────────────────────────────────────
    redis_status = "healthy"
    try:
        await notification_queue.health_check()
    except Exception as e:
        redis_status = f"unhealthy: {str(e)}"

    # ── Overall status ─────────────────────────────────────────────
    overall = "healthy" if db_status == "healthy" and redis_status == "healthy" else "degraded"

    return HealthResponse(
        status=overall,
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        database=db_status,
        redis=redis_status,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe — returns 200 only if the service can handle requests.
    """
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "not ready"})
