from fastapi import APIRouter

from app.routes.claims import router as claims_router
from app.routes.dashboard import router as dashboard_router
from app.routes.icd10 import router as icd10_router
from app.routes.gdrg import router as gdrg_router
from app.routes.nhia import router as nhia_router
from app.routes.medications import router as medications_router
from app.routes.lab_investigations import router as lab_router
from app.routes.batches import router as batches_router

api_router = APIRouter(prefix="/api/v1/claims")

api_router.include_router(claims_router, prefix="", tags=["Claims"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(icd10_router, prefix="/icd10", tags=["ICD-10"])
api_router.include_router(gdrg_router, prefix="/coding", tags=["GDRG Coding"])
api_router.include_router(nhia_router, prefix="/nhia", tags=["NHIA"])
api_router.include_router(medications_router, prefix="/medications", tags=["Medications"])
api_router.include_router(lab_router, prefix="/lab-investigations", tags=["Lab Investigations"])
api_router.include_router(batches_router, prefix="/batches", tags=["Claim Batches"])
