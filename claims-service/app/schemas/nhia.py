"""Pydantic schemas for NHIA export and vetting operations."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class NHIAExportRequest(BaseModel):
    date_range: Optional[List[str]] = None
    statuses: List[str] = []
    institution_id: Optional[UUID] = None


class NHIAExportResponse(BaseModel):
    batch_number: str
    file_name: str
    total_claims: int
    total_amount: float
    status: str


class NHISClaimExportRecord(BaseModel):
    id: UUID
    batch_number: str
    institution_id: UUID
    file_name: str
    total_claims: int
    total_amount: float
    export_status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VettingResult(BaseModel):
    is_valid: bool
    format: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    results: Optional[List[Dict[str, Any]]] = None
    claim_data: Optional[Any] = None
    error: Optional[str] = None
    errors: Optional[List[str]] = None


class BatchCreate(BaseModel):
    institution_id: UUID


class BatchResponse(BaseModel):
    id: UUID
    batch_number: str
    total_amount: float
    claim_count: int
    status: str
    institution_id: UUID
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BatchAddClaim(BaseModel):
    batch_id: UUID
    claim_id: UUID
