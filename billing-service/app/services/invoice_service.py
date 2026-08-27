"""Invoice service - manages invoice lifecycle."""

import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.models.service_bill import ServiceBill
from app.models.payment import Payment
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceSummary


class InvoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_invoice_number(self) -> str:
        """Generate a unique invoice number."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count(Invoice.id)).where(Invoice.created_at >= today_start)
        )
        seq = result.scalar() + 1
        return f"INV-{timestamp}-{seq:04d}"

    async def create_invoice(self, data: InvoiceCreate, created_by: Optional[UUID] = None) -> Invoice:
        """Create a new draft invoice."""
        invoice_number = await self.generate_invoice_number()

        invoice = Invoice(
            invoice_number=invoice_number,
            patient_id=data.patient_id,
            visit_id=data.visit_id,
            institution_id=data.institution_id,
            department_id=data.department_id,
            notes=data.notes,
            due_date=data.due_date,
            currency=data.currency,
            status="draft",
            created_by=created_by,
        )
        self.db.add(invoice)
        await self.db.flush()
        return invoice

    async def get_invoice(self, invoice_id: UUID) -> Optional[Invoice]:
        """Fetch a single invoice by ID."""
        result = await self.db.execute(select(Invoice).where(Invoice.id == invoice_id))
        return result.scalar_one_or_none()

    async def list_invoices(
        self,
        institution_id: Optional[UUID] = None,
        patient_id: Optional[UUID] = None,
        visit_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 30,
    ) -> Tuple[List[Invoice], int]:
        """List invoices with filters and pagination."""
        query = select(Invoice)
        count_query = select(func.count(Invoice.id))
        conditions = []

        if institution_id:
            conditions.append(Invoice.institution_id == institution_id)
        if patient_id:
            conditions.append(Invoice.patient_id == patient_id)
        if visit_id:
            conditions.append(Invoice.visit_id == visit_id)
        if status:
            conditions.append(Invoice.status == status)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total = (await self.db.execute(count_query)).scalar() or 0

        query = query.order_by(Invoice.created_at.desc())
        query = query.offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        invoices = list(result.scalars().all())

        return invoices, total

    async def update_invoice(self, invoice_id: UUID, data: InvoiceUpdate) -> Optional[Invoice]:
        """Update invoice metadata."""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(invoice, key, value)
        invoice.updated_at = datetime.utcnow()
        return invoice

    async def add_service_bill(self, invoice_id: UUID, bill_data: Dict) -> ServiceBill:
        """Add a service bill line item to an invoice."""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")

        bill = ServiceBill(
            invoice_id=invoice_id,
            visit_id=bill_data["visit_id"],
            patient_id=bill_data["patient_id"],
            institution_id=bill_data["institution_id"],
            department_id=bill_data.get("department_id"),
            service_id=bill_data.get("service_id"),
            service_type=bill_data["service_type"],
            description=bill_data["description"],
            unit_price=bill_data["unit_price"],
            quantity=bill_data.get("quantity", 1),
            nhia_amount=bill_data.get("nhia_amount", 0),
            claim_id=bill_data.get("claim_id"),
            prescription_id=bill_data.get("prescription_id"),
        )
        bill.compute_amounts()

        if bill.nhia_amount > 0:
            bill.is_nhia_covered = True

        self.db.add(bill)
        await self.db.flush()

        await self._recompute_invoice(invoice)
        return bill

    async def _recompute_invoice(self, invoice: Invoice):
        """Recompute invoice totals from all linked service bills."""
        result = await self.db.execute(
            select(ServiceBill).where(ServiceBill.invoice_id == invoice.id)
        )
        bills = list(result.scalars().all())
        invoice.service_bills = bills
        invoice.compute_totals()
        invoice.updated_at = datetime.utcnow()

    async def finalize_invoice(self, invoice_id: UUID) -> Optional[Invoice]:
        """Move invoice from draft to pending (ready for payment)."""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            return None
        if invoice.status != "draft":
            raise ValueError(f"Cannot finalize invoice in '{invoice.status}' status")

        await self._recompute_invoice(invoice)
        invoice.status = "pending"
        invoice.updated_at = datetime.utcnow()
        return invoice

    async def get_summary(self, institution_id: UUID) -> InvoiceSummary:
        """Get invoice summary stats for an institution."""
        base_filter = Invoice.institution_id == institution_id

        total = (await self.db.execute(
            select(func.count(Invoice.id)).where(base_filter)
        )).scalar() or 0

        total_amount = (await self.db.execute(
            select(func.sum(Invoice.total_amount)).where(base_filter)
        )).scalar() or 0

        total_paid = (await self.db.execute(
            select(func.sum(Invoice.amount_paid)).where(base_filter)
        )).scalar() or 0

        total_outstanding = (await self.db.execute(
            select(func.sum(Invoice.balance_due)).where(
                and_(base_filter, Invoice.balance_due > 0)
            )
        )).scalar() or 0

        nhia_covered = (await self.db.execute(
            select(func.sum(Invoice.nhia_covered_amount)).where(base_filter)
        )).scalar() or 0

        status_result = await self.db.execute(
            select(Invoice.status, func.count(Invoice.id))
            .where(base_filter)
            .group_by(Invoice.status)
        )
        by_status = {row[0]: row[1] for row in status_result.all()}

        return InvoiceSummary(
            total_invoices=total,
            total_amount=float(total_amount),
            total_paid=float(total_paid),
            total_outstanding=float(total_outstanding),
            nhia_covered=float(nhia_covered),
            by_status=by_status,
        )
