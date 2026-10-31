from typing import Optional
from fastapi import Depends, Header, HTTPException, status


def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Заглушка авторизации.

    Сейчас:
      - нет заголовка Authorization → гость (None);
      - есть любой Bearer-токен → «авторизованный» тестовый юзер.

    Потом:
      - распарсить JWT, найти User в БД, вернуть его или None.
      - Ни один эндпоинт менять не придётся — интерфейс уже зафиксирован.
    """
    if not authorization:
        return None
    # TODO: decode JWT, validate, load User from DB
    return {"id": 1, "email": "dev@local"}


def require_user(user: Optional[dict] = Depends(get_current_user)) -> dict:
    """Зависимость для мутирующих эндпоинтов — 401, если юзер не авторизован."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user