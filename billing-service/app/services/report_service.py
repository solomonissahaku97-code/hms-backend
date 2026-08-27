"""Report service - generates financial reports and dashboard data."""

from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import select, func, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.nhia_claim import NHIAClaim
from app.schemas.reports import (
    RevenueReport, OutstandingBalanceReport, NHIAClaimSummary,
    FinancialDashboard, DailyRevenue,
)


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_revenue_report(
        self, institution_id: UUID, days: int = 30
    ) -> RevenueReport:
        """Generate revenue report for the last N days."""
        start_date = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(
                cast(Payment.paid_at, Date).label("date"),
                func.sum(Payment.amount).label("revenue"),
                func.count(Payment.id).label("transaction_count"),
            )
            .where(
                and_(
                    Payment.institution_id == institution_id,
                    Payment.status == "completed",
                    Payment.paid_at >= start_date,
                )
            )
            .group_by(cast(Payment.paid_at, Date))
            .order_by(cast(Payment.paid_at, Date))
        )
        rows = result.all()

        daily_breakdown = [
            DailyRevenue(
                date=str(row.date),
                revenue=float(row.revenue or 0),
                transaction_count=row.transaction_count,
            )
            for row in rows
        ]

        total_revenue = sum(d.revenue for d in daily_breakdown)
        total_transactions = sum(d.transaction_count for d in daily_breakdown)

        return RevenueReport(
            period="last_{}_days".format(days),
            days=days,
            total_revenue=total_revenue,
            total_transactions=total_transactions,
            daily_breakdown=daily_breakdown,
        )

    async def get_outstanding_balances(
        self, institution_id: UUID
    ) -> OutstandingBalanceReport:
        """Get outstanding balance report with aging."""
        now = datetime.utcnow()

        total_result = await self.db.execute(
            select(func.sum(Invoice.balance_due)).where(
                and_(
                    Invoice.institution_id == institution_id,
                    Invoice.balance_due > 0,
                )
            )
        )
        total_outstanding = float(total_result.scalar() or 0)

        count_result = await self.db.execute(
            select(func.count(Invoice.id)).where(
                and_(
                    Invoice.institution_id == institution_id,
                    Invoice.balance_due > 0,
                )
            )
        )
        total_invoices = count_result.scalar() or 0

        aging = {}  # type: Dict[str, float]
        for label, days_min, days_max in [
            ("0-30_days", 0, 30),
            ("31-60_days", 31, 60),
            ("61-90_days", 61, 90),
            ("90+_days", 91, 3650),
        ]:
            start = now - timedelta(days=days_max)
            end = now - timedelta(days=days_min) if days_min > 0 else now
            result = await self.db.execute(
                select(func.sum(Invoice.balance_due)).where(
                    and_(
                        Invoice.institution_id == institution_id,
                        Invoice.balance_due > 0,
                        Invoice.created_at >= start,
                        Invoice.created_at < end,
                    )
                )
            )
            aging[label] = float(result.scalar() or 0)

        return OutstandingBalanceReport(
            total_outstanding=total_outstanding,
            total_invoices=total_invoices,
            by_age=aging,
            top_patients=[],
        )

    async def get_nhia_summary(
        self, institution_id: UUID
    ) -> NHIAClaimSummary:
        """Get NHIA claims summary."""
        base = NHIAClaim.institution_id == institution_id

        total = (await self.db.execute(
            select(func.count(NHIAClaim.id)).where(base)
        )).scalar() or 0

        total_claimed = float((await self.db.execute(
            select(func.sum(NHIAClaim.total_amount)).where(base)
        )).scalar() or 0)

        total_approved = float((await self.db.execute(
            select(func.sum(NHIAClaim.nhia_amount)).where(
                and_(base, NHIAClaim.status.in_(["approved", "paid"]))
            )
        )).scalar() or 0)

        total_paid = float((await self.db.execute(
            select(func.sum(NHIAClaim.nhia_amount)).where(
                and_(base, NHIAClaim.status == "paid")
            )
        )).scalar() or 0)

        total_rejected = float((await self.db.execute(
            select(func.sum(NHIAClaim.total_amount)).where(
                and_(base, NHIAClaim.status == "rejected")
            )
        )).scalar() or 0)

        approval_rate = (total_approved / total_claimed * 100) if total_claimed > 0 else 0

        status_result = await self.db.execute(
            select(NHIAClaim.status, func.count(NHIAClaim.id))
            .where(base)
            .group_by(NHIAClaim.status)
        )
        by_status = {row[0]: row[1] for row in status_result.all()}

        return NHIAClaimSummary(
            total_claims=total,
            total_claimed=total_claimed,
            total_approved=total_approved,
            total_paid=total_paid,
            total_rejected=total_rejected,
            approval_rate=round(approval_rate, 1),
            by_status=by_status,
        )

    async def get_dashboard(self, institution_id: UUID) -> FinancialDashboard:
        """Get comprehensive billing dashboard."""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)

        month_rev = float((await self.db.execute(
            select(func.sum(Payment.amount)).where(
                and_(
                    Payment.institution_id == institution_id,
                    Payment.status == "completed",
                    Payment.paid_at >= month_start,
                )
            )
        )).scalar() or 0)

        today_rev = float((await self.db.execute(
            select(func.sum(Payment.amount)).where(
                and_(
                    Payment.institution_id == institution_id,
                    Payment.status == "completed",
                    Payment.paid_at >= today,
                )
            )
        )).scalar() or 0)

        outstanding = float((await self.db.execute(
            select(func.sum(Invoice.balance_due)).where(
                and_(
                    Invoice.institution_id == institution_id,
                    Invoice.balance_due > 0,
                )
            )
        )).scalar() or 0)

        nhia_covered = float((await self.db.execute(
            select(func.sum(Invoice.nhia_covered_amount)).where(
                Invoice.institution_id == institution_id
            )
        )).scalar() or 0)

        payments_today = (await self.db.execute(
            select(func.count(Payment.id)).where(
                and_(
                    Payment.institution_id == institution_id,
                    Payment.status == "completed",
                    Payment.paid_at >= today,
                )
            )
        )).scalar() or 0

        invoices_today = (await self.db.execute(
            select(func.count(Invoice.id)).where(
                and_(
                    Invoice.institution_id == institution_id,
                    Invoice.created_at >= today,
                )
            )
        )).scalar() or 0

        nhia_pending = (await self.db.execute(
            select(func.count(NHIAClaim.id)).where(
                and_(
                    NHIAClaim.institution_id == institution_id,
                    NHIAClaim.status.in_(["draft", "submitted", "processing"]),
                )
            )
        )).scalar() or 0

        trend = await self.get_revenue_report(institution_id, days=7)

        return FinancialDashboard(
            total_revenue_this_month=month_rev,
            total_revenue_today=today_rev,
            total_outstanding=outstanding,
            total_nhia_covered=nhia_covered,
            payments_today=payments_today,
            invoices_created_today=invoices_today,
            nhia_claims_pending=nhia_pending,
            revenue_trend=trend.daily_breakdown,
        )
