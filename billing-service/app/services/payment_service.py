"""Payment service - processes and tracks payments."""

from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.service_bill import ServiceBill
from app.schemas.payment import PaymentCreate
from app.utils.helpers import generate_transaction_id


class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_payment(self, data: PaymentCreate) -> Payment:
        """Process a payment against an invoice or service bill."""
        if data.amount <= 0:
            raise ValueError("Payment amount must be greater than zero")

        target_invoice = None
        target_bill = None

        if data.invoice_id:
            target_invoice = await self._get_invoice(data.invoice_id)
            if not target_invoice:
                raise ValueError("Invoice not found")
            if float(target_invoice.balance_due or 0) <= 0:
                raise ValueError("Invoice is already fully paid")
        elif data.service_bill_id:
            target_bill = await self._get_bill(data.service_bill_id)
            if not target_bill:
                raise ValueError("Service bill not found")
            if target_bill.payment_status == "Paid":
                raise ValueError("Service bill is already fully paid")
            if target_bill.invoice_id:
                target_invoice = await self._get_invoice(target_bill.invoice_id)
        else:
            raise ValueError("Either invoice_id or service_bill_id is required")

        transaction_id = generate_transaction_id("TXN")
        payment = Payment(
            transaction_id=transaction_id,
            invoice_id=data.invoice_id,
            service_bill_id=data.service_bill_id,
            patient_id=data.patient_id,
            institution_id=data.institution_id,
            amount=data.amount,
            payment_method=data.payment_method,
            payment_type=data.payment_type,
            reference_number=data.reference_number,
            notes=data.notes,
            insurance_provider=data.insurance_provider,
            insurance_policy_number=data.insurance_policy_number,
            status="completed",
            paid_at=datetime.utcnow(),
        )
        self.db.add(payment)

        if target_bill:
            if data.amount >= float(target_bill.total_amount):
                target_bill.payment_status = "Paid"
                target_bill.has_paid = True
                target_bill.paid_at = datetime.utcnow()

        if target_invoice:
            current_amount_paid = float(target_invoice.amount_paid or 0)
            new_amount_paid = current_amount_paid + data.amount
            new_balance = max(0, float(target_invoice.total_amount) - new_amount_paid)
            new_balance = round(new_balance, 2)

            target_invoice.amount_paid = new_amount_paid
            target_invoice.balance_due = new_balance

            if new_balance <= 0:
                target_invoice.status = "paid"
                target_invoice.paid_at = datetime.utcnow()
            elif new_amount_paid > 0:
                target_invoice.status = "partially_paid"

            target_invoice.updated_at = datetime.utcnow()

        await self.db.flush()
        return payment

    async def get_payment(self, payment_id: UUID) -> Optional[Payment]:
        result = await self.db.execute(select(Payment).where(Payment.id == payment_id))
        return result.scalar_one_or_none()

    async def list_payments(
        self,
        institution_id: Optional[UUID] = None,
        patient_id: Optional[UUID] = None,
        invoice_id: Optional[UUID] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        limit: int = 30,
    ) -> Tuple[List[Payment], int]:
        """List payments with filters."""
        query = select(Payment)
        count_query = select(func.count(Payment.id))
        conditions = []

        if institution_id:
            conditions.append(Payment.institution_id == institution_id)
        if patient_id:
            conditions.append(Payment.patient_id == patient_id)
        if invoice_id:
            conditions.append(Payment.invoice_id == invoice_id)
        if payment_method:
            conditions.append(Payment.payment_method == payment_method)
        if start_date and end_date:
            conditions.append(Payment.paid_at.between(start_date, end_date))

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total = (await self.db.execute(count_query)).scalar() or 0
        query = query.order_by(Payment.created_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)

        return list(result.scalars().all()), total

    async def refund_payment(self, payment_id: UUID, reason: Optional[str] = None) -> Payment:
        """Refund a completed payment."""
        payment = await self.get_payment(payment_id)
        if not payment:
            raise ValueError("Payment not found")
        if payment.status != "completed":
            raise ValueError(f"Cannot refund payment with status: {payment.status}")

        payment.status = "refunded"
        payment.notes = "REFUND: {}".format(reason) if reason else "Refunded"
        payment.updated_at = datetime.utcnow()

        if payment.invoice_id:
            invoice = await self._get_invoice(payment.invoice_id)
            if invoice:
                invoice.amount_paid = max(0, float(invoice.amount_paid or 0) - float(payment.amount))
                invoice.balance_due = float(invoice.total_amount) - invoice.amount_paid
                invoice.status = "pending"
                invoice.updated_at = datetime.utcnow()

        await self.db.flush()
        return payment

    async def _get_invoice(self, invoice_id: UUID) -> Optional[Invoice]:
        result = await self.db.execute(select(Invoice).where(Invoice.id == invoice_id))
        return result.scalar_one_or_none()

    async def _get_bill(self, bill_id: UUID) -> Optional[ServiceBill]:
        result = await self.db.execute(select(ServiceBill).where(ServiceBill.id == bill_id))
        return result.scalar_one_or_none()
