"""
Seed-скрипт: создаёт demo-пользователя и наполняет его дерево из test-family.ged.
"""
import sys
from pathlib import Path

from sqlalchemy import select

from auth import hash_password
from database import SessionLocal, engine
from gedcom_import import import_gedcom
from models import Base, Individual, Tree, User

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo123"
DEMO_DISPLAY_NAME = "Demo User"
DEMO_TREE_NAME = "Демо-дерево"

GED_PATH = Path(__file__).parent / "test-family.ged"

def main() -> int:
    Base.metadata.create_all(bind=engine)

    if not GED_PATH.exists():
        print(f"[seed] ERROR: файл не найден: {GED_PATH}", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        # 1. Создаем пользователя
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if not user:
            user = User(
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                display_name=DEMO_DISPLAY_NAME,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[seed] Создан пользователь: {DEMO_EMAIL} (id={user.id})")
        else:
            print(f"[seed] Пользователь уже существует: {DEMO_EMAIL} (id={user.id})")

        # 2. Создаем дерево
        tree = db.scalar(select(Tree).where(Tree.owner_id == user.id).order_by(Tree.id))
        if not tree:
            tree = Tree(owner_id=user.id, name=DEMO_TREE_NAME)
            db.add(tree)
            db.commit()
            db.refresh(tree)
            print(f"[seed] Создано дерево: '{tree.name}' (id={tree.id})")
        else:
            print(f"[seed] Дерево уже существует: '{tree.name}' (id={tree.id})")

        # 3. Импортируем GEDCOM
        existing = db.scalar(
            select(Individual)
            .where(Individual.tree_id == tree.id, Individual.deleted_at.is_(None))
            .limit(1)
        )

        if not existing:
            print(f"[seed] Импорт GEDCOM: {GED_PATH.name}")
            try:
                counts = import_gedcom(str(GED_PATH), tree.id, db)
                db.commit()
                print(f"[seed] Импорт завершён: {counts['individuals']} персон, {counts['families']} семей")
            except Exception as e:
                db.rollback()
                print(f"[seed] ERROR при импорте: {e}", file=sys.stderr)
                raise
        else:
            print(f"[seed] Дерево уже содержит данные, импорт пропущен")

    return 0

if __name__ == "__main__":
    sys.exit(main())