"""Pydantic schemas for GDRG and ICD-10 operations."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class GDRGCodeCreate(BaseModel):
    code: Optional[str] = None
    description: str
    condition: Optional[str] = None
    category: Optional[str] = None
    market_price: float = 0
    nhia_price: float = 0
    coverage_percentage: float = 0
    is_nhia_covered: bool = True


class GDRGCodeUpdate(BaseModel):
    description: Optional[str] = None
    condition: Optional[str] = None
    category: Optional[str] = None
    market_price: Optional[float] = None
    nhia_price: Optional[float] = None
    is_nhia_covered: Optional[bool] = None


class GDRGCodeResponse(BaseModel):
    id: UUID
    code: Optional[str] = None
    description: str
    condition: Optional[str] = None
    category: Optional[str] = None
    market_price: float = 0
    nhia_price: float = 0
    is_nhia_covered: bool = True
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SystemDiagnosisCreate(BaseModel):
    icd_10_code: str
    diagnosis_name: str
    gender: Optional[str] = None


class SystemDiagnosisResponse(BaseModel):
    id: UUID
    icd_10_code: str
    diagnosis_name: str
    gender: Optional[str] = None

    model_config = {"from_attributes": True}


class ICD10ToGDRGCreate(BaseModel):
    gdrg_code: str
    gdrg_description: str
    condition: str = "None"
    icd10_codes: List[str]
    icd10_diagnoses: List[str]


class ICD10ToGDRGResponse(BaseModel):
    id: UUID
    gdrg_code: str
    gdrg_description: str
    condition: str
    icd10_codes: List[str]
    icd10_diagnoses: List[str]
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
