"""
Seed-скрипт: создаёт demo-пользователя и наполняет его дерево из test-family.ged.
Идемпотентен — повторный запуск не дублирует данные.

Запуск:
    python seed.py
"""
import hashlib
import sys
from pathlib import Path

from sqlalchemy import select

from database import SessionLocal, engine
from gedcom_import import import_gedcom
from models import Base, Individual, Tree, User


DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo123"
DEMO_DISPLAY_NAME = "Demo User"
DEMO_TREE_NAME = "Демо-дерево"

GED_PATH = Path(__file__).parent / "test-family.ged"


def _hash_password(password: str) -> str:
    """Та же заглушка, что и в main.py (этап 6 заменит на bcrypt)."""
    return "DEV:" + hashlib.sha256(password.encode()).hexdigest()


def main() -> int:
    Base.metadata.create_all(bind=engine)

    if not GED_PATH.exists():
        print(f"[seed] ERROR: файл не найден: {GED_PATH}", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        # --- 1. Пользователь ---
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user:
            print(f"[seed] Пользователь уже существует: {DEMO_EMAIL} (id={user.id})")
        else:
            user = User(
                email=DEMO_EMAIL,
                password_hash=_hash_password(DEMO_PASSWORD),
                display_name=DEMO_DISPLAY_NAME,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[seed] Создан пользователь: {DEMO_EMAIL} (id={user.id})")

        # --- 2. Дерево ---
        tree = db.scalar(
            select(Tree).where(Tree.owner_id == user.id).order_by(Tree.id)
        )
        if tree:
            print(f"[seed] Дерево уже существует: '{tree.name}' (id={tree.id})")
        else:
            tree = Tree(owner_id=user.id, name=DEMO_TREE_NAME)
            db.add(tree)
            db.commit()
            db.refresh(tree)
            print(f"[seed] Создано дерево: '{tree.name}' (id={tree.id})")

        # --- 3. Проверка: есть ли уже живые персоны? ---
        existing = db.scalar(
            select(Individual)
            .where(
                Individual.tree_id == tree.id,
                Individual.deleted_at.is_(None),
            )
            .limit(1)
        )
        if existing:
            print(f"[seed] Дерево уже содержит данные, импорт пропущен")
            return 0

        # --- 4. Импорт GEDCOM ---
        print(f"[seed] Импорт GEDCOM: {GED_PATH.name}")
        try:
            counts = import_gedcom(str(GED_PATH), tree.id, db)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[seed] ERROR при импорте: {e}", file=sys.stderr)
            raise

        print(
            f"[seed] Импорт завершён: "
            f"{counts['individuals']} персон, "
            f"{counts['families']} семей, "
            f"{counts['child_links']} связей родитель-ребёнок"
        )
        print(
            f"[seed] Войти как demo: "
            f"email={DEMO_EMAIL}, password={DEMO_PASSWORD}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())