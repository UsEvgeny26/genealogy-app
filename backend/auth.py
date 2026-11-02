from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import User


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Заглушка авторизации.
    Bearer-токен сейчас = email пользователя. На этапе 6 заменим на session-id из cookie.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()
    if not token:
        return None

    user = db.scalar(select(User).where(User.email == token))
    return user


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    """401, если не авторизован."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

