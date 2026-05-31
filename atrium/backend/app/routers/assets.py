"""Assets router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.asset import Asset
from app.models.booking import Booking

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("")
async def list_assets(db: AsyncSession = Depends(get_db)):
    stmt = select(Asset).where(Asset.is_active == True)  # noqa: E712
    result = await db.execute(stmt)
    return [a.to_dict() for a in result.scalars().all()]


@router.get("/{asset_id}")
async def get_asset(asset_id: str, db: AsyncSession = Depends(get_db)):
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset.to_dict()


@router.get("/{asset_id}/bookings")
async def asset_bookings(asset_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Booking).where(
        Booking.asset_id == asset_id,
        Booking.state.in_(["confirmed", "held", "swap_pending"]),
    )
    result = await db.execute(stmt)
    return [b.to_dict() for b in result.scalars().all()]
