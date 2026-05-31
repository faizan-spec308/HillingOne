from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import AISearchRequest, AIBookRequest
from app.services import ai_agent_service

router = APIRouter(prefix="/ai", tags=["AI Agent"])


@router.post("/search")
def ai_search(request: AISearchRequest, db: Session = Depends(get_db)):
    """Natural language facility search — returns up to 3 confidence-scored suggestions."""
    return ai_agent_service.search_facilities(request.query, db)


@router.post("/book")
def ai_book(request: AIBookRequest, db: Session = Depends(get_db)):
    """Agentic booking — parse intent, find slot, create booking in one call."""
    return ai_agent_service.book_facility(request.query, request.user_id, db)
