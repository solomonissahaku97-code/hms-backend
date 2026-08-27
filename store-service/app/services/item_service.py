"""Item service - manages stock items catalog."""

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.models.item_batch import ItemBatch
from app.models.stock_alert import StockAlert
from app.schemas.store import ItemCreate, ItemUpdate


class ItemService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_item(self, data: ItemCreate) -> Item:
        item = Item(**data.model_dump())
        self.db.add(item)
        await self.db.flush()
        return item

    async def get_item(self, item_id: UUID) -> Optional[Item]:
        result = await self.db.execute(select(Item).where(Item.id == item_id))
        return result.scalar_one_or_none()

    async def list_items(
        self, institution_id: Optional[UUID] = None, category: Optional[str] = None,
        search: Optional[str] = None, page: int = 1, limit: int = 50,
    ) -> Tuple[List[Item], int]:
        query = select(Item)
        count_query = select(func.count(Item.id))
        conditions = [Item.is_active == True]

        if institution_id:
            conditions.append(Item.institution_id == institution_id)
        if category:
            conditions.append(Item.category == category)
        if search:
            conditions.append(
                or_(Item.name.ilike(f"%{search}%"), Item.description.ilike(f"%{search}%"))
            )

        from sqlalchemy import and_
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total = (await self.db.execute(count_query)).scalar() or 0
        query = query.order_by(Item.created_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def update_item(self, item_id: UUID, data: ItemUpdate) -> Optional[Item]:
        item = await self.get_item(item_id)
        if not item:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        return item

    async def deactivate_item(self, item_id: UUID) -> bool:
        item = await self.get_item(item_id)
        if not item:
            return False
        item.is_active = False
        return True

    async def get_low_stock_items(self, institution_id: Optional[UUID] = None) -> List[dict]:
        query = select(ItemBatch).where(ItemBatch.status == "active")
        if institution_id:
            query = query.where(ItemBatch.institution_id == institution_id)
        result = await self.db.execute(query)
        batches = list(result.scalars().all())

        low_stock = []
        for batch in batches:
            # Fetch item name
            item = await self.get_item(batch.item_id)
            if item and batch.current_quantity <= item.reorder_level:
                low_stock.append({
                    "id": batch.id,
                    "item_id": batch.item_id,
                    "item_name": item.name,
                    "category": item.category.value if item.category else None,
                    "current_quantity": batch.current_quantity,
                    "reorder_level": item.reorder_level,
                    "critical_level": item.critical_level,
                    "batch_number": batch.batch_number,
                    "is_critical": batch.current_quantity <= item.critical_level,
                })
        return low_stock
