"""Batch service - manages stock batches with expiry tracking."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_batch import ItemBatch
from app.models.inventory_record import InventoryRecord
from app.models.stock_alert import StockAlert
from app.schemas.store import BatchCreate


class BatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_batch(self, data: BatchCreate) -> ItemBatch:
        batch_number = data.batch_number or f"BATCH-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        batch = ItemBatch(
            id=uuid4(),
            institution_id=data.institution_id,
            item_id=data.item_id,
            batch_number=batch_number,
            quantity=data.quantity,
            current_quantity=data.quantity,
            unit_cost=data.unit_cost,
            selling_price=data.selling_price,
            supplier_id=data.supplier_id,
            expiry_date=data.expiry_date,
            manufacture_date=data.manufacture_date,
            location=data.location,
            notes=data.notes,
        )
        self.db.add(batch)

        # Create inventory record
        record = InventoryRecord(
            id=uuid4(),
            institution_id=data.institution_id,
            item_id=data.item_id,
            batch_id=batch.id,
            quantity=data.quantity,
            movement_type="restocked",
            reference_type="purchase",
            reference_id=batch.id,
            notes=f"Initial stock: {data.quantity} units",
        )
        self.db.add(record)
        await self.db.flush()
        return batch

    async def list_batches(
        self, institution_id: Optional[UUID] = None, search: Optional[str] = None,
        low_stock: bool = False,
    ) -> List[ItemBatch]:
        query = select(ItemBatch)
        if institution_id:
            query = query.where(ItemBatch.institution_id == institution_id)
        if low_stock:
            query = query.where(ItemBatch.status == "active")
        query = query.order_by(ItemBatch.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_batch(self, batch_id: UUID) -> Optional[ItemBatch]:
        result = await self.db.execute(select(ItemBatch).where(ItemBatch.id == batch_id))
        return result.scalar_one_or_none()

    async def issue_items(self, items: list, department_id: UUID, issued_by: UUID, institution_id: Optional[UUID] = None) -> list:
        """Issue multiple items to a department."""
        issued_results = []
        for line in items:
            batch = await self.get_batch(line["batch_id"])
            if not batch:
                raise ValueError(f"Batch not found: {line['batch_id']}")
            if batch.current_quantity < line["quantity"]:
                raise ValueError(f"Insufficient stock for batch {batch.batch_number}")

            batch.current_quantity -= line["quantity"]
            if batch.current_quantity == 0:
                batch.status = "depleted"

            from app.models.issued_item import IssuedItem
            issued = IssuedItem(
                id=uuid4(),
                institution_id=institution_id,
                item_id=line["item_id"],
                batch_id=batch.id,
                department_id=department_id,
                quantity=line["quantity"],
                issued_by=issued_by,
            )
            self.db.add(issued)

            record = InventoryRecord(
                id=uuid4(),
                institution_id=institution_id,
                item_id=line["item_id"],
                batch_id=batch.id,
                department_id=department_id,
                quantity=-line["quantity"],
                movement_type="issued",
                reference_type="direct_issue",
                reference_id=issued.id,
            )
            self.db.add(record)
            issued_results.append(issued)

        await self.db.flush()
        return issued_results

    async def adjust_stock(self, batch_id: UUID, adjustment_type: str, quantity: int, reason: str, adjusted_by: UUID, institution_id: Optional[UUID] = None):
        """Adjust stock quantity up or down."""
        batch = await self.get_batch(batch_id)
        if not batch:
            raise ValueError("Batch not found")

        if adjustment_type == "decrease" and batch.current_quantity < quantity:
            raise ValueError("Insufficient stock for decrease")

        batch.current_quantity = batch.current_quantity + quantity if adjustment_type == "increase" else batch.current_quantity - quantity
        if batch.current_quantity == 0:
            batch.status = "depleted"
        elif batch.status == "depleted" and batch.current_quantity > 0:
            batch.status = "active"

        from app.models.stock_adjustment import StockAdjustment
        adjustment = StockAdjustment(
            id=uuid4(),
            institution_id=institution_id,
            item_id=batch.item_id,
            batch_id=batch.id,
            adjustment_number=f"ADJ-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            adjustment_type=adjustment_type,
            quantity=quantity,
            reason=reason,
            adjusted_by=adjusted_by,
            adjusted_at=datetime.utcnow(),
        )
        self.db.add(adjustment)

        record = InventoryRecord(
            id=uuid4(),
            institution_id=institution_id,
            item_id=batch.item_id,
            batch_id=batch.id,
            quantity=quantity if adjustment_type == "increase" else -quantity,
            movement_type="adjusted",
            reference_type="adjustment",
            reference_id=adjustment.id,
            notes=reason,
        )
        self.db.add(record)
        await self.db.flush()
        return adjustment

    async def get_valuation(self, institution_id: Optional[UUID] = None) -> dict:
        """Get stock valuation report."""
        query = select(ItemBatch).where(ItemBatch.status == "active", ItemBatch.current_quantity > 0)
        if institution_id:
            query = query.where(ItemBatch.institution_id == institution_id)
        result = await self.db.execute(query)
        batches = list(result.scalars().all())

        items = []
        total = 0.0
        for b in batches:
            value = float(b.current_quantity) * float(b.unit_cost)
            total += value
            items.append({
                "item_id": b.item_id,
                "batch_number": b.batch_number,
                "quantity": b.current_quantity,
                "unit_cost": float(b.unit_cost),
                "total_value": round(value, 2),
                "expiry_date": b.expiry_date,
            })
        return {"items": items, "total_value": round(total, 2)}
