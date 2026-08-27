from fastapi import APIRouter

from app.routes.items import router as items_router
from app.routes.batches import router as batches_router
from app.routes.suppliers import router as suppliers_router
from app.routes.requests import router as requests_router
from app.routes.transfers import router as transfers_router
from app.routes.dashboard import router as dashboard_router

api_router = APIRouter(prefix="/api/v1/store")

api_router.include_router(items_router, prefix="/items", tags=["Items"])
api_router.include_router(batches_router, prefix="/batches", tags=["Batches"])
api_router.include_router(suppliers_router, prefix="/suppliers", tags=["Suppliers"])
api_router.include_router(requests_router, prefix="/requests", tags=["Stock Requests"])
api_router.include_router(transfers_router, prefix="/transfers", tags=["Transfers"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
