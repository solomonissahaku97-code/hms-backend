"""Enum types used across the claims service."""

import enum


class ClaimStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING = "Pending"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    RESUBMITTED = "Resubmitted"


class ClaimItemType(str, enum.Enum):
    LAB_TEST = "LabTest"
    MEDICATION = "Medication"
    CONSULTATION = "Consultation"
    PROCEDURE = "Procedure"
    SERVICE = "Service"
    DIAGNOSIS = "Diagnosis"


class BatchStatus(str, enum.Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class ExportStatus(str, enum.Enum):
    PENDING = "Pending"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    REJECTED = "Rejected"


# Valid claim status transitions
CLAIM_STATUS_TRANSITIONS = {
    "Draft": ["Pending", "Draft"],
    "Pending": ["Submitted", "Rejected", "Resubmitted", "Draft"],
    "Submitted": ["Approved", "Rejected", "Resubmitted", "Submitted"],
    "Approved": ["Approved"],
    "Rejected": ["Resubmitted", "Pending", "Rejected"],
    "Resubmitted": ["Submitted", "Approved", "Rejected", "Resubmitted"],
}
