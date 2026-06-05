"""Authentication router — register, login, me."""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    ward: str | None = None
    role: str = "resident"


class LoginRequest(BaseModel):
    email: str
    password: str


def _make_token(user: User) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    return jwt.encode(
        {"sub": str(user.id), "role": user.role, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


@router.post("/register", status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    # Only allow resident self-registration; staff accounts created by admins
    role = "resident" if req.role not in ("staff", "councillor") else "resident"

    user = User(
        id=uuid.uuid4(),
        email=req.email.lower(),
        name=req.name,
        role=role,
        ward=req.ward,
        password_hash=pwd.hash(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"token": _make_token(user), "user": user.to_dict()}


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not pwd.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"token": _make_token(user), "user": user.to_dict()}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return current_user.to_dict()
