from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, or_, and_, inspect, text
from sqlalchemy.orm import Session
from auth import get_current_user, require_user

from database import engine, get_db
from models import Base, ParentChild, Person, Marriage, Relation
from schemas import (
    PersonCreate,
    PersonDetail,
    PersonExtendedDetail,
    PersonUpdate,
    TreeDataResponse,
    TreeEdge,
    TreeNode,
    MarriageCreate,
    MarriageShort,
    MarriageUpdate,
    RelationCreate,
    RelationShort,
    ParentChildCreate,
)

# Создаем таблицы при старте (для SQLite)
Base.metadata.create_all(bind=engine)

def _run_migrations():
    """ALTER TABLE для SQLite: добавление колонки kind в parent_child."""
    insp = inspect(engine)
    if 'parent_child' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('parent_child')]
    if 'kind' not in cols:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE parent_child ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'biological'"
            ))
        print('[migration] parent_child.kind added')

#_run_migrations()
#Base.metadata.create_all(bind=engine)

def _migrate_adoptive_relations():
    """Переносит Relation(type='adoptive_parent') в ParentChild(kind='adoptive')."""
    from models import ParentChild, Relation
    from database import SessionLocal
    with SessionLocal() as db:
        rows = db.scalars(select(Relation).where(Relation.type == 'adoptive_parent')).all()
        for r in rows:
            existing = db.scalar(select(ParentChild).where(
                ParentChild.parent_id == r.from_id,
                ParentChild.child_id == r.to_id,
            ))
            if existing:
                existing.kind = 'adoptive'
            else:
                db.add(ParentChild(parent_id=r.from_id, child_id=r.to_id, kind='adoptive'))
            db.delete(r)
        db.commit()
        if rows:
            print(f'[migration] {len(rows)} adoptive relations moved to parent_child')

#_migrate_adoptive_relations()


app = FastAPI(title="Genealogy Tree API")

# Настройка CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Разрешить GET, POST, PUT, DELETE и т.д.
    allow_headers=["*"],  # Разрешить любые заголовки
)


@app.get("/api/auth/me")
def get_me(user: Optional[dict] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# 1. Получение всего дерева (для рендеринга на React-холсте)
@app.get("/api/tree", response_model=TreeDataResponse)
def get_full_tree(db: Session = Depends(get_db)):
    persons = db.scalars(select(Person)).all()
    relations = db.scalars(select(ParentChild)).all()
    marriages = db.scalars(select(Marriage)).all()
    extra_relations = db.scalars(select(Relation)).all()

    nodes = [
        TreeNode(
            id=p.id,
            first_name=p.first_name,
            last_name=p.last_name,
            patronymic=p.patronymic,
            gender=p.gender,
            is_alive=p.is_alive,
            photo_url=p.photo_url,
        )
        for p in persons
    ]

    edges = [
        TreeEdge(source_id=r.parent_id, target_id=r.child_id, kind=r.kind or 'biological')
        for r in relations
    ]

    return TreeDataResponse(
        nodes=nodes,
        edges=edges,
        marriages=[MarriageShort.model_validate(m) for m in marriages],
        relations=[RelationShort.model_validate(r) for r in extra_relations],
    )



# 2. Создание новой карточки человека

@app.post("/api/persons", response_model=PersonDetail, status_code=status.HTTP_201_CREATED)
def create_person(person_in: PersonCreate, db: Session = Depends(get_db), user: dict = Depends(require_user),):
    person = Person(**person_in.model_dump())
    db.add(person)
    db.commit()
    db.refresh(person)
    return person



# 3. Краткая информация о человеке (базовый просмотр)
@app.get("/api/persons/{person_id}", response_model=PersonDetail)
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


# 4. Расширенная информация о человеке со всеми полями
@app.get("/api/persons/{person_id}/extended", response_model=PersonExtendedDetail)
def get_person_extended(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


# 5. Редактирование личных и расширенных данных
@app.put("/api/persons/{person_id}", response_model=PersonExtendedDetail)
def update_person(person_id: int, person_in: PersonUpdate, db: Session = Depends(get_db), user: dict = Depends(require_user),):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    update_data = person_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(person, field, value)

    db.commit()
    db.refresh(person)
    return person


# 6. Удаление человека
@app.delete("/api/persons/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(person_id: int, db: Session = Depends(get_db), user: dict = Depends(require_user),):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    db.delete(person)
    db.commit()



# 7. Добавление связи «родитель-ребенок»
@app.post("/api/persons/{child_id}/parents/{parent_id}", response_model=PersonDetail)
def add_parent_relation(child_id: int, parent_id: int, db: Session = Depends(get_db), user: dict = Depends(require_user),):
    if child_id == parent_id:
        raise HTTPException(status_code=400, detail="Person cannot be their own parent")

    child = db.get(Person, child_id)
    parent = db.get(Person, parent_id)

    if not child or not parent:
        raise HTTPException(status_code=404, detail="Child or Parent not found")

    existing = db.scalar(
        select(ParentChild).where(
            ParentChild.parent_id == parent_id,
            ParentChild.child_id == child_id,
        )
    )
    if not existing:
        relation = ParentChild(parent_id=parent_id, child_id=child_id)
        db.add(relation)
        db.commit()
        db.refresh(child)

    return child


# 9. Создание связи родитель-ребёнок
@app.post("/api/parent-child", response_model=PersonDetail, status_code=status.HTTP_201_CREATED)
def create_parent_child(
    data: ParentChildCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_user),
):
    if data.parent_id == data.child_id:
        raise HTTPException(status_code=400, detail="Нельзя связать человека с самим собой")
    if data.kind not in ('biological', 'adoptive'):
        raise HTTPException(status_code=400, detail="Недопустимый тип родительства")

    parent = db.get(Person, data.parent_id)
    child = db.get(Person, data.child_id)
    if not parent or not child:
        raise HTTPException(status_code=404, detail="Родитель или ребёнок не найден")

    # Проверка цикла: child не должен быть предком parent
    def is_ancestor(a_id: int, b_id: int) -> bool:
        """True, если a_id является предком b_id."""
        visited = set()
        stack = [b_id]
        while stack:
            cur = stack.pop()
            if cur in visited:
                continue
            visited.add(cur)
            rows = db.scalars(select(ParentChild).where(ParentChild.child_id == cur)).all()
            for r in rows:
                if r.parent_id == a_id:
                    return True
                stack.append(r.parent_id)
        return False

    if is_ancestor(data.child_id, data.parent_id):
        raise HTTPException(status_code=400, detail="Это создаст цикл в дереве")

    existing = db.get(ParentChild, (data.parent_id, data.child_id))
    if existing:
        existing.kind = data.kind
    else:
        db.add(ParentChild(
            parent_id=data.parent_id,
            child_id=data.child_id,
            kind=data.kind,
        ))
    db.commit()
    return child


# 10. Удаление связи родитель-ребёнок
@app.delete("/api/parent-child/{parent_id}/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parent_child(
    parent_id: int,
    child_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_user),
):
    rel = db.get(ParentChild, (parent_id, child_id))
    if not rel:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    db.delete(rel)
    db.commit()


# # 8. Удаление связи «родитель-ребенок»
# @app.delete("/api/persons/{child_id}/parents/{parent_id}", status_code=status.HTTP_204_NO_CONTENT)
# def remove_parent_relation(child_id: int, parent_id: int, db: Session = Depends(get_db),user: dict = Depends(require_user),):
#     relation = db.scalar(
#         select(ParentChild).where(
#             ParentChild.parent_id == parent_id,
#             ParentChild.child_id == child_id,
#         )
#     )
#     if not relation:
#         raise HTTPException(status_code=404, detail="Relationship not found")
#
#     db.delete(relation)
#     db.commit()
    
    

# 9. Создание брака
@app.post("/api/marriages", response_model=MarriageShort, status_code=status.HTTP_201_CREATED)
def create_marriage(
    data: MarriageCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_user),
):
    if data.spouse1_id == data.spouse2_id:
        raise HTTPException(status_code=400, detail="Нельзя создать брак с самим собой")

    s1 = db.get(Person, data.spouse1_id)
    s2 = db.get(Person, data.spouse2_id)
    if not s1 or not s2:
        raise HTTPException(status_code=404, detail="Один из супругов не найден")

    existing = db.scalar(
        select(Marriage).where(
            or_(
                and_(Marriage.spouse1_id == data.spouse1_id, Marriage.spouse2_id == data.spouse2_id),
                and_(Marriage.spouse1_id == data.spouse2_id, Marriage.spouse2_id == data.spouse1_id),
            )
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Брак между этими людьми уже существует")

    marriage = Marriage(**data.model_dump())
    db.add(marriage)
    db.commit()
    db.refresh(marriage)
    return marriage



# 10. Удаление брака
@app.delete("/api/marriages/{marriage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_marriage(
    marriage_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_user),
):
    m = db.get(Marriage, marriage_id)
    if not m:
        raise HTTPException(status_code=404, detail="Marriage not found")
    db.delete(m)
    db.commit()



# 11. Обновление брака (статус, даты, заметки) — для развода
@app.put("/api/marriages/{marriage_id}", response_model=MarriageShort)
def update_marriage(
    marriage_id: int,
    data: MarriageUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_user),
):
    m = db.get(Marriage, marriage_id)
    if not m:
        raise HTTPException(status_code=404, detail="Marriage not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(m, field, value)

    db.commit()
    db.refresh(m)
    return m



# 12. Создание произвольной связи (приёмные родители, крёстные, ...)

ALLOWED_RELATION_TYPES = {"godparent"}


@app.post("/api/relations", response_model=RelationShort, status_code=status.HTTP_201_CREATED)
def create_relation(
    data: RelationCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_user),
):
    if data.from_id == data.to_id:
        raise HTTPException(status_code=400, detail="Нельзя связать человека с самим собой")
    if data.type not in ALLOWED_RELATION_TYPES:
        raise HTTPException(status_code=400, detail=f"Недопустимый тип связи: {data.type}")

    p1 = db.get(Person, data.from_id)
    p2 = db.get(Person, data.to_id)
    if not p1 or not p2:
        raise HTTPException(status_code=404, detail="Один из людей не найден")

    existing = db.scalar(
        select(Relation).where(
            Relation.type == data.type,
            Relation.from_id == data.from_id,
            Relation.to_id == data.to_id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Такая связь уже существует")

    relation = Relation(**data.model_dump())
    db.add(relation)
    db.commit()
    db.refresh(relation)
    return relation



# 13. Удаление произвольной связи

@app.delete("/api/relations/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_relation(
    relation_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_user),
):
    r = db.get(Relation, relation_id)
    if not r:
        raise HTTPException(status_code=404, detail="Relation not found")
    db.delete(r)
    db.commit()