"""Shared type aliases and utilities."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    CASH = "cash"
    MOBILE_MONEY = "mobile_money"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    INSURANCE = "insurance"
    NHIA = "nhia"
    CHEQUE = "cheque"


class ServiceType(str, Enum):
    MEDICATION = "Medication"
    LAB_TEST = "LabTest"
    PROCEDURE = "Procedure"
    CONSULTATION = "Consultation"
    OTHER = "Other"


class ClaimStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    APPROVED = "approved"
    PARTIALLY_APPROVED = "partially_approved"
    REJECTED = "rejected"
    PAID = "paid"


class Currency(str, Enum):
    GHS = "GHS"
    USD = "USD"
    NGN = "NGN"
