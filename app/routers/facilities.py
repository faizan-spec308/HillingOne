from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.database import get_db
from app.models import Facility
from typing import Optional

router = APIRouter(prefix="/facilities", tags=["Facilities"])


def _serialize(f: Facility) -> dict:
    return {
        "id": f.id,
        "name": f.name,
        "category_id": f.category_id,
        "category": f.category.name if f.category else None,
        "category_icon": f.category.icon if f.category else None,
        "location": f.location,
        "address": f.address,
        "capacity": f.capacity,
        "hourly_rate": float(f.hourly_rate) if f.hourly_rate else None,
        "description": f.description,
        "amenities": f.amenities or [],
        "accessibility": f.accessibility,
        "parking": f.parking,
        "is_active": f.is_active,
    }


# /search must be declared BEFORE /{facility_id} to avoid route conflict
@router.get("/search")
def search_facilities(
    q: str = Query(..., description="Search term — matched against name, description, and location"),
    db: Session = Depends(get_db),
):
    """
    Full-text search across all active facilities.

    Case-insensitive partial match on facility name, description, and location.
    Useful for free-text discovery before passing a facility ID to the booking flow.
    """
    facilities = (
        db.query(Facility)
        .options(joinedload(Facility.category))
        .filter(
            Facility.is_active == True,
            or_(
                Facility.name.ilike(f"%{q}%"),
                Facility.description.ilike(f"%{q}%"),
                Facility.location.ilike(f"%{q}%"),
            ),
        )
        .all()
    )
    return [_serialize(f) for f in facilities]


@router.get("")
def get_facilities(
    category_id: Optional[int] = None,
    location: Optional[str] = None,
    min_capacity: Optional[int] = None,
    parking: Optional[bool] = None,
    accessibility: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """
    List all active facilities with optional filters.

    All parameters are optional and can be combined freely:
    - **category_id**: filter to a single service category
    - **location**: partial, case-insensitive match on town/area (e.g. `Hayes`)
    - **min_capacity**: only return facilities with capacity ≥ this value
    - **parking**: `true` to require on-site parking
    - **accessibility**: `true` to require step-free / accessible facilities
    """
    q = (
        db.query(Facility)
        .options(joinedload(Facility.category))
        .filter(Facility.is_active == True)
    )
    if category_id:
        q = q.filter(Facility.category_id == category_id)
    if location:
        q = q.filter(Facility.location.ilike(f"%{location}%"))
    if min_capacity:
        q = q.filter(Facility.capacity >= min_capacity)
    if parking is not None:
        q = q.filter(Facility.parking == parking)
    if accessibility is not None:
        q = q.filter(Facility.accessibility == accessibility)
    return [_serialize(f) for f in q.all()]


@router.get("/{facility_id}")
def get_facility(facility_id: int, db: Session = Depends(get_db)):
    """
    Return full details for a single facility.

    Includes category metadata, full address, amenities list,
    accessibility and parking flags, and hourly rate.
    Returns 404 if the facility does not exist.
    """
    facility = (
        db.query(Facility)
        .options(joinedload(Facility.category))
        .filter(Facility.id == facility_id)
        .first()
    )
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return _serialize(facility)
