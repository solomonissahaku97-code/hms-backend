"""Utility helpers for claims service."""

import uuid
import secrets
import hashlib
from datetime import datetime
from decimal import Decimal
from typing import Optional


def generate_claim_reference() -> str:
    """Generate a unique claim reference number."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_part = secrets.token_hex(4).upper()
    return f"CLM-{timestamp}-{random_part}"


def generate_batch_number(serial_code: str = "UNK") -> str:
    """Generate a batch number for NHIA export."""
    timestamp = int(datetime.utcnow().timestamp())
    random_part = secrets.token_hex(3).upper()
    return f"NHIS-{serial_code}-{timestamp}-{random_part}"


def calculate_split(
    unit_price: float,
    quantity: int,
    insured: bool,
    covered: bool,
    nhia_rate: float = 0,
) -> dict:
    """Calculate NHIA/Co-payment split for a claim item.

    Returns exact Decimal-based amounts for financial precision.
    """
    qty = max(int(quantity or 1), 1)
    price = Decimal(str(unit_price or 0))
    amount = price * qty
    is_covered = covered and Decimal(str(nhia_rate)) > 0

    nhia_amount = Decimal(0)
    if insured and is_covered:
        nhia_amount = min(amount, Decimal(str(nhia_rate)) * qty)

    co_payment = max(Decimal(0), amount - nhia_amount)

    return {
        "amount": float(amount),
        "nhia_amount": float(nhia_amount),
        "co_payment": float(co_payment),
        "actual_amount": float(co_payment),
        "paid_by_patient": not (insured and is_covered),
    }


def format_nhia_date(date: Optional[datetime]) -> Optional[str]:
    """Format date for NHIA XML (DD/MM/YYYY)."""
    if not date:
        return None
    return date.strftime("%d/%m/%Y")


def is_valid_icd10(code: str) -> bool:
    """Validate ICD-10 code format."""
    import re
    return bool(re.match(r"^[A-Z][0-9]{2}(\.[0-9]{1,4})?$", code))
