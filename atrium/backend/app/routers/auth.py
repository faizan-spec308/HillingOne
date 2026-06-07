"""Authentication router — register, login, me."""
import re
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt as _bcrypt
from pydantic import BaseModel, EmailStr, Field, field_validator
from jose import jwt
import logging

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("hillingone.auth")


def _hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode()[:72], _bcrypt.gensalt()).decode()


def _verify(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode()[:72], hashed.encode())


def _make_token(user: User) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    return jwt.encode(
        {"sub": str(user.id), "role": user.role, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    ward: str | None = Field(None, max_length=100)
    role: str = "resident"

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


@router.post("/register", status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == str(req.email).lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="email_exists")

    user = User(
        id=uuid.uuid4(),
        email=str(req.email).lower(),
        name=req.name,
        role="resident",
        ward=req.ward,
        password_hash=_hash(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("register_success user_id=%s", str(user.id))
    return {"token": _make_token(user), "user": user.to_dict()}


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == str(req.email).lower()))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not _verify(req.password, user.password_hash):
        logger.warning("login_failed email=%s", str(req.email))
        raise HTTPException(status_code=401, detail="invalid_credentials")
    logger.info("login_success user_id=%s", str(user.id))
    return {"token": _make_token(user), "user": user.to_dict()}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return current_user.to_dict()


class CreateStaffRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = "staff"

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v


@router.post("/create-staff", status_code=201)
async def create_staff(
    req: CreateStaffRequest,
    db: AsyncSession = Depends(get_db),
    x_admin_secret: str = Header(..., alias="X-Admin-Secret"),
):
    """Create a staff/councillor account. Requires X-Admin-Secret header."""
    if not settings.admin_secret or x_admin_secret != settings.admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret.")
    if req.role not in ("staff", "councillor", "admin"):
        raise HTTPException(status_code=400, detail="Role must be staff, councillor, or admin.")
    existing = await db.execute(select(User).where(User.email == str(req.email).lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="email_exists")
    user = User(
        id=uuid.uuid4(),
        email=str(req.email).lower(),
        name=req.name,
        role=req.role,
        password_hash=_hash(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("create_staff_success user_id=%s role=%s", str(user.id), req.role)
    return {"token": _make_token(user), "user": user.to_dict()}
