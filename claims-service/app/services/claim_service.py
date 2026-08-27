"""Claim service - manages claim lifecycle, status transitions, and NHIA splits."""

from datetime import datetime
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.models.claim_item import ClaimItem
from app.schemas.claim import ClaimItemCreate, ClaimItemResponse
from app.utils.types import CLAIM_STATUS_TRANSITIONS
from app.utils.helpers import generate_claim_reference, calculate_split


class ClaimService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_claim_reference(self) -> str:
        """Generate a unique claim reference number."""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count(Claim.id)).where(Claim.created_at >= today_start)
        )
        seq = (result.scalar() or 0) + 1
        return f"CLM-{timestamp}-{seq:04d}"

    async def create_claim(self, visit_id: UUID) -> Claim:
        """Create a new claim for a visit. Returns existing if one already exists."""
        existing = await self.db.execute(
            select(Claim).where(Claim.visit_id == visit_id)
        )
        existing_claim = existing.scalar_one_or_none()
        if existing_claim:
            return existing_claim

        ref_number = await self.generate_claim_reference()
        claim = Claim(
            visit_id=visit_id,
            claim_reference_number=ref_number,
            claim_status="Pending",
            submission_date=datetime.utcnow(),
        )
        self.db.add(claim)
        await self.db.flush()
        return claim

    async def get_claim(self, claim_id: UUID) -> Optional[Claim]:
        """Fetch a single claim by ID."""
        result = await self.db.execute(select(Claim).where(Claim.id == claim_id))
        return result.scalar_one_or_none()

    async def list_claims(
        self,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: int = 1,
        limit: int = 10,
    ) -> Tuple[List[Claim], int]:
        """List claims with filters and pagination."""
        query = select(Claim)
        count_query = select(func.count(Claim.id))
        conditions = []

        if status:
            conditions.append(Claim.claim_status == status)
        if start_date:
            conditions.append(Claim.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            conditions.append(Claim.created_at <= datetime.fromisoformat(end_date))

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total = (await self.db.execute(count_query)).scalar() or 0
        query = query.order_by(Claim.created_at.desc())
        query = query.offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        claims = list(result.scalars().all())

        return claims, total

    async def update_claim_status(self, claim_id: UUID, new_status: str) -> Claim:
        """Update claim status with transition validation."""
        claim = await self.get_claim(claim_id)
        if not claim:
            raise ValueError("Claim not found")

        current = claim.claim_status.value if hasattr(claim.claim_status, 'value') else str(claim.claim_status)
        if new_status == current:
            return claim

        allowed = CLAIM_STATUS_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValueError(
                f"Invalid claim status transition: {current} -> {new_status}. "
                f"Allowed: {', '.join(allowed)}"
            )

        claim.claim_status = new_status
        claim.updated_at = datetime.utcnow()
        return claim

    async def add_claim_item(self, claim_id: UUID, item_data: ClaimItemCreate) -> ClaimItem:
        """Add an item to a claim with automatic amount calculation."""
        claim = await self.get_claim(claim_id)
        if not claim:
            raise ValueError("Claim not found")

        # Idempotency check
        if item_data.item_id and item_data.item_type:
            existing = await self.db.execute(
                select(ClaimItem).where(
                    and_(
                        ClaimItem.claim_id == claim_id,
                        ClaimItem.item_type == item_data.item_type,
                        ClaimItem.item_id == item_data.item_id,
                    )
                )
            )
            existing_item = existing.scalar_one_or_none()
            if existing_item:
                return existing_item

        # Calculate split
        split = calculate_split(
            unit_price=item_data.unit_price or 0,
            quantity=item_data.quantity or 1,
            insured=False,  # Will be resolved from visit context
            covered=bool(item_data.nhia_amount and item_data.nhia_amount > 0),
            nhia_rate=item_data.nhia_amount or 0,
        )

        item = ClaimItem(
            claim_id=claim_id,
            visit_id=claim.visit_id,
            item_type=item_data.item_type,
            item_id=item_data.item_id,
            service_bill_id=item_data.service_bill_id,
            gdrg_code=item_data.gdrg_code,
            description=item_data.description,
            unit_price=item_data.unit_price,
            quantity=item_data.quantity,
            nhia_amount=split["nhia_amount"],
            co_payment=split["co_payment"],
            actual_amount=split["actual_amount"],
            paid_by_patient=split["paid_by_patient"],
            amount=split["amount"],
            performed_by=item_data.performed_by,
            corresponding_diagnosis_id=item_data.corresponding_diagnosis_id,
        )
        self.db.add(item)
        await self.db.flush()

        # Recompute claim totals
        await self._recompute_claim_totals(claim)
        return item

    async def remove_claim_item(self, claim_id: UUID, item_id: UUID) -> None:
        """Remove a claim item."""
        result = await self.db.execute(
            select(ClaimItem).where(
                and_(ClaimItem.id == item_id, ClaimItem.claim_id == claim_id)
            )
        )
        item = result.scalar_one_or_none()
        if not item:
            raise ValueError("Claim item not found")

        await self.db.delete(item)
        await self.db.flush()

        claim = await self.get_claim(claim_id)
        if claim:
            await self._recompute_claim_totals(claim)

    async def _recompute_claim_totals(self, claim: Claim):
        """Recompute claim totals from items."""
        result = await self.db.execute(
            select(ClaimItem).where(ClaimItem.claim_id == claim.id)
        )
        items = list(result.scalars().all())
        claim.items = items
        claim.recompute_totals()
        claim.updated_at = datetime.utcnow()

    async def get_dashboard_summary(self) -> Dict:
        """Get claim summary stats."""
        total = (await self.db.execute(select(func.count(Claim.id)))).scalar() or 0
        total_amount = (await self.db.execute(select(func.sum(Claim.total_amount)))).scalar() or 0

        status_result = await self.db.execute(
            select(Claim.claim_status, func.count(Claim.id)).group_by(Claim.claim_status)
        )
        breakdown = {}
        for row in status_result.all():
            status_val = row[0].value if hasattr(row[0], 'value') else str(row[0])
            breakdown[status_val] = row[1]

        return {
            "total_claims": total,
            "total_amount": float(total_amount),
            "status_breakdown": breakdown,
        }

    async def approve_batch(self, batch_id: UUID) -> int:
        """Approve all claims in a batch."""
        result = await self.db.execute(
            select(Claim).where(Claim.batch_id == batch_id)
        )
        claims = list(result.scalars().all())
        for claim in claims:
            claim.claim_status = "Approved"
            claim.updated_at = datetime.utcnow()
        return len(claims)
