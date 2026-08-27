from fastapi import APIRouter

from app.routes.invoices import router as invoices_router
from app.routes.payments import router as payments_router
from app.routes.service_bills import router as service_bills_router
from app.routes.nhia import router as nhia_router
from app.routes.reports import router as reports_router

api_router = APIRouter(prefix="/api/v1/billing")

api_router.include_router(invoices_router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(payments_router, prefix="/payments", tags=["Payments"])
api_router.include_router(service_bills_router, prefix="/bills", tags=["Service Bills"])
api_router.include_router(nhia_router, prefix="/nhia", tags=["NHIA Claims"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
