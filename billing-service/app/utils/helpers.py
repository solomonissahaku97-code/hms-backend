"""Shared utility functions."""

import uuid
from datetime import datetime


def generate_transaction_id(prefix: str = "TXN") -> str:
    """Generate a unique transaction ID."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    short_uuid = uuid.uuid4().hex[:8].upper()
    return f"{prefix}-{timestamp}-{short_uuid}"


def generate_claim_reference(prefix: str = "NHIA") -> str:
    """Generate a unique NHIA claim reference."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-CLM-{timestamp}-{short_uuid}"


def calculate_nhia_split(total_amount: float, nhia_rate: float = 0.0) -> tuple[float, float]:
    """
    Calculate NHIA and patient amounts.
    Returns (nhia_amount, patient_amount).
    """
    if nhia_rate <= 0:
        return 0.0, total_amount
    nhia_amount = round(total_amount * nhia_rate, 2)
    patient_amount = round(total_amount - nhia_amount, 2)
    return max(0, nhia_amount), max(0, patient_amount)
