import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session as DBSession

from database import get_db
from models import Session as UserSession, User


SESSION_COOKIE_NAME = "session_id"
SESSION_TTL_DAYS = 30

# Пароли
def hash_password(password: str) -> str:
    """bcrypt-хеш пароля."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """
    Проверяет пароль. Поддерживает:
      - bcrypt ($2b$...)  — новый формат
      - DEV:<sha256>      — legacy из заглушки
    """
    if not password_hash:
        return False

    if password_hash.startswith("DEV:"):
        legacy = "DEV:" + hashlib.sha256(password.encode()).hexdigest()
        return secrets.compare_digest(legacy, password_hash)

    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True, если хеш в legacy-формате и его стоит перевести на bcrypt."""
    return bool(password_hash) and password_hash.startswith("DEV:")

# Сессии
def create_session(user_id: int, db: DBSession) -> UserSession:
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS)
    session = UserSession(id=token, user_id=user_id, expires_at=expires_at)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def delete_session(session_id: str, db: DBSession) -> None:
    session = db.get(UserSession, session_id)
    if session:
        db.delete(session)
        db.commit()


def cleanup_expired_sessions(db: DBSession) -> int:
    from sqlalchemy import delete as sa_delete
    result = db.execute(
        sa_delete(UserSession).where(UserSession.expires_at < datetime.utcnow())
    )
    db.commit()
    return result.rowcount or 0

# Cookie
def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=False,  # ← True в production (HTTPS)
        max_age=SESSION_TTL_DAYS * 24 * 3600,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")

# Зависимости
def get_current_user(
    session_id: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: DBSession = Depends(get_db),
) -> Optional[User]:
    if not session_id:
        return None

    session = db.get(UserSession, session_id)
    if not session:
        return None

    if session.expires_at < datetime.utcnow():
        db.delete(session)
        db.commit()
        return None

    user = db.get(User, session.user_id)
    if not user or not user.is_active:
        return None

    return user


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
        )
    return user


def get_current_session_id(
    session_id: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> Optional[str]:
    return session_id