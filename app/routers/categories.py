from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Category
from app.schemas import CategoryResponse
from typing import List

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """
    Return all 10 service categories.

    Categories span: Community Halls, Sports Facilities, Meeting Rooms,
    Parks & Open Spaces, Equipment Hire, Registry Services, Housing Appointments,
    Benefits Consultations, Library Spaces, and Youth Centres.
    Each category includes a name, description, and icon identifier.
    """
    return db.query(Category).order_by(Category.id).all()
