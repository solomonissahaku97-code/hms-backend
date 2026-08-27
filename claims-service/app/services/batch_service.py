"""Claim Batch service."""

import secrets
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim_batch import ClaimBatch
from app.models.claim import Claim


class BatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_batch(self, institution_id: UUID) -> ClaimBatch:
        """Create a new claim batch."""
        batch_number = f"BATCH-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(2).upper()}"
        batch = ClaimBatch(
            batch_number=batch_number,
            institution_id=institution_id,
            total_amount=0,
            claim_count=0,
        )
        self.db.add(batch)
        await self.db.flush()
        return batch

    async def add_claim_to_batch(self, batch_id: UUID, claim_id: UUID) -> ClaimBatch:
        """Add a claim to a batch."""
        batch = await self.db.execute(
            select(ClaimBatch).where(ClaimBatch.id == batch_id)
        )
        batch = batch.scalar_one_or_none()
        if not batch:
            raise ValueError("Batch not found")

        claim = await self.db.execute(
            select(Claim).where(Claim.id == claim_id)
        )
        claim = claim.scalar_one_or_none()
        if not claim:
            raise ValueError("Claim not found")
        if claim.batch_id:
            raise ValueError("Claim already assigned to a batch")

        claim.batch_id = batch_id
        claim.updated_at = datetime.utcnow()

        # Recalculate batch totals
        result = await self.db.execute(
            select(Claim).where(Claim.batch_id == batch_id)
        )
        claims = list(result.scalars().all())
        batch.total_amount = sum(float(c.total_amount or 0) for c in claims)
        batch.claim_count = len(claims)

        return batch

    async def get_batches_by_institution(self, institution_id: UUID) -> list:
        """Get all batches for an institution."""
        result = await self.db.execute(
            select(ClaimBatch).where(ClaimBatch.institution_id == institution_id)
        )
        return list(result.scalars().all())

    async def submit_batch(self, batch_id: UUID) -> ClaimBatch:
        """Submit a batch for NHIA processing."""
        result = await self.db.execute(
            select(ClaimBatch).where(ClaimBatch.id == batch_id)
        )
        batch = result.scalar_one_or_none()
        if not batch:
            raise ValueError("Batch not found")
        batch.status = "Submitted"
        batch.submission_date = datetime.utcnow()
        return batch
