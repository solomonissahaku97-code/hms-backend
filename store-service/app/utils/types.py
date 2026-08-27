"""Enum types for store service."""

import enum


class ItemCategory(str, enum.Enum):
    MEDICINE = "medicine"
    MEDICAL_EQUIPMENT = "medical_equipment"
    SURGICAL_SUPPLIES = "surgical_supplies"
    LABORATORY = "laboratory"
    RADIOLOGY = "radiology"
    CONSUMABLES = "consumables"
    OFFICE_SUPPLIES = "office_supplies"
    CLEANING_SUPPLIES = "cleaning_supplies"


class BatchStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    DEPLETED = "depleted"
    RECALLED = "recalled"


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PARTIALLY_APPROVED = "partially_approved"
    REJECTED = "rejected"
    ISSUED = "issued"
    CANCELLED = "cancelled"


class TransferStatus(str, enum.Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MovementType(str, enum.Enum):
    ISSUED = "issued"
    RESTOCKED = "restocked"
    TRANSFERRED = "transferred"
    ADJUSTED = "adjusted"


class AlertType(str, enum.Enum):
    LOW_STOCK = "low_stock"
    EXPIRY_SOON = "expiry_soon"
    OUT_OF_STOCK = "out_of_stock"
    OVER_STOCK = "over_stock"


class Priority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
