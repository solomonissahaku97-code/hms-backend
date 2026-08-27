"""HMS inter-service HTTP client."""

from typing import Any, Optional

import httpx
import structlog

from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


class HMSClient:
    """HTTP client for calling the main HMS backend."""

    def __init__(self):
        self.base_url = settings.hms_backend_url
        self.headers = {
            "Content-Type": "application/json",
            "X-Service-Key": settings.hms_service_key,
        }

    async def _get(self, path: str) -> Optional[Any]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{self.base_url}{path}", headers=self.headers)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Failed to GET {path}: {e}")
            return None

    async def _post(self, path: str, data: dict) -> Optional[Any]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(f"{self.base_url}{path}", json=data, headers=self.headers)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Failed to POST {path}: {e}")
            return None

    async def get_patient(self, patient_id: str) -> Optional[dict]:
        return await self._get(f"/api/v1/patients/{patient_id}")

    async def get_visit(self, visit_id: str) -> Optional[dict]:
        return await self._get(f"/api/v1/visits/{visit_id}")

    async def get_institution(self, institution_id: str) -> Optional[dict]:
        return await self._get(f"/api/v1/institutions/{institution_id}")

    async def get_staff(self, staff_id: str) -> Optional[dict]:
        return await self._get(f"/api/v1/staff/{staff_id}")

    async def create_invoice(self, data: dict) -> Optional[dict]:
        return await self._post("/api/v1/invoices", data)


hms_client = HMSClient()
