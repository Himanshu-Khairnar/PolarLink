from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_token

ROLE_LABELS = {
    "hq_logistics": "HQ Logistics Officer",
    "expedition_leader": "Expedition Leader",
    "station_leader": "Station Leader",
    "inventory_keeper": "Store / Inventory Keeper",
    "medical_officer": "Medical Officer",
    "ship_air_ops": "Ship / Air Ops Coordinator",
    "member": "Expedition Member",
}


def current_user_optional(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """Decode the bearer token when present; never hard-fails.

    The field PWA must keep working while the link is down, so read endpoints
    stay reachable and RBAC is enforced where it matters via require_roles.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    payload = decode_token(authorization.split(" ", 1)[1])
    if not payload:
        return None
    return db.get(User, payload.get("sub"))


def current_user(user: User | None = Depends(current_user_optional)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def require_roles(*roles: str):
    def _dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return _dep
