from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import current_user_optional, require_roles
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(models.User).where(models.User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(subject=user.id, role=user.role, station_id=user.station_id)
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)


@router.get("/me", response_model=UserOut | None)
def me(user: models.User | None = Depends(current_user_optional)) -> models.User | None:
    return user


@router.get("/users", response_model=list[UserOut])
def users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles("hq_logistics")),
) -> list[models.User]:
    return list(db.scalars(select(models.User)))
