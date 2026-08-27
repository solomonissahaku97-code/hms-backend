"""Pydantic schemas for financial reports."""

from typing import Dict, List, Optional
from pydantic import BaseModel


class DailyRevenue(BaseModel):
    date: str
    revenue: float
    transaction_count: int
    nhia_amount: float = 0


class RevenueReport(BaseModel):
    period: str
    days: int
    total_revenue: float
    total_transactions: int
    daily_breakdown: List[DailyRevenue]


class OutstandingBalanceReport(BaseModel):
    total_outstanding: float
    total_invoices: int
    by_age: Dict  # {"0-30_days": ..., "31-60_days": ..., "61-90_days": ..., "90+_days": ...}
    top_patients: List[Dict]


class NHIAClaimSummary(BaseModel):
    total_claims: int
    total_claimed: float
    total_approved: float
    total_paid: float
    total_rejected: float
    approval_rate: float
    by_status: Dict[str, int]


class FinancialDashboard(BaseModel):
    total_revenue_this_month: float
    total_revenue_today: float
    total_outstanding: float
    total_nhia_covered: float
    payments_today: int
    invoices_created_today: int
    nhia_claims_pending: int
    revenue_trend: List[DailyRevenue]
