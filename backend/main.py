import hashlib
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user, require_user
from database import engine, get_db
from models import (
    Association, Base, Family, FamilyChild, FamilyStatus,
    Individual, Tree, User,
)
from schemas import (
    AssociationCreate, AssociationShort,
    FamilyCreate, FamilyDetail, FamilyShort, FamilyUpdate,
    FamilyChildCreate, FamilyChildShort,
    IndividualCreate, IndividualDetail, IndividualShort, IndividualUpdate,
    LoginRequest, TreeCreate, TreeListItem, TreeNode, TreeShort,
    TreeStats, TreeUpdate, TreeGraphResponse, TreeFamilyNode,
    TreeMarriageEdge, TreeChildEdge, TreeAssociationEdge,
    UserCreate, UserPublic, TreeOrphanParentEdge,
)


DEMO_EMAIL = "demo@example.com"

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Genealogy Tree API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Утилиты

def hash_password(password: str) -> str:
    """Временный хеш. Заменить на bcrypt/argon2 на этапе 6."""
    return "DEV:" + hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hash_: str) -> bool:
    return hash_password(password) == hash_


def get_tree_or_403(tree_id: int, user: User, db: Session) -> Tree:
    tree = db.get(Tree, tree_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Дерево не найдено")
    if tree.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому дереву")
    return tree


def get_or_create_default_tree(user: User, db: Session) -> Tree:
    tree = db.scalar(
        select(Tree).where(Tree.owner_id == user.id).order_by(Tree.id)
    )
    if tree:
        return tree
    tree = Tree(owner_id=user.id, name="Моё дерево")
    db.add(tree)
    db.commit()
    db.refresh(tree)
    return tree


def serialize_user(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        created_at=user.created_at,
    )

# Auth

@app.post("/api/auth/register", response_model=UserPublic, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise HTTPException(status_code=400, detail="Этот email уже зарегистрирован")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        display_name=data.display_name or data.email.split("@")[0],
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Первое дерево для пользователя
    get_or_create_default_tree(user, db)

    return serialize_user(user)


@app.post("/api/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email))
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Пользователь деактивирован")

    # Заглушка: токен = email. На этапе 6 вернём session-id.
    return {
        "token": user.email,
        "user": serialize_user(user),
    }


@app.get("/api/auth/me", response_model=UserPublic)
def get_me(user: User = Depends(require_user)):
    return serialize_user(user)


@app.post("/api/auth/logout", status_code=204)
def logout(user: User = Depends(require_user), db: Session = Depends(get_db)):
    # Заглушка: на этапе 6 удалим session.
    # Сейчас просто возвращаем 204 — фронт удалит токен из localStorage.
    return None


# Trees
def _tree_stats(tree_id: int, db: Session) -> TreeStats:
    ind_count = db.scalar(
        select(func.count(Individual.id))
        .where(Individual.tree_id == tree_id, Individual.deleted_at.is_(None))
    ) or 0
    fam_count = db.scalar(
        select(func.count(Family.id))
        .where(Family.tree_id == tree_id, Family.deleted_at.is_(None))
    ) or 0
    return TreeStats(
        individuals_count=ind_count,
        families_count=fam_count,
        generations=0,  # TODO: посчитать поколения при необходимости
    )


@app.get("/api/trees", response_model=List[TreeListItem])
def list_trees(user: User = Depends(require_user), db: Session = Depends(get_db)):
    trees = db.scalars(
        select(Tree).where(Tree.owner_id == user.id).order_by(Tree.id)
    ).all()

    return [
        TreeListItem(
            id=t.id,
            name=t.name,
            description=t.description,
            created_at=t.created_at,
            updated_at=t.updated_at,
            stats=_tree_stats(t.id, db),
        )
        for t in trees
    ]


@app.post("/api/trees", response_model=TreeShort, status_code=201)
def create_tree(
    data: TreeCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    tree = Tree(owner_id=user.id, name=data.name, description=data.description)
    db.add(tree)
    db.commit()
    db.refresh(tree)
    return tree


@app.get("/api/trees/{tree_id}", response_model=TreeShort)
def get_tree(tree_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    tree = get_tree_or_403(tree_id, user, db)
    return tree


@app.patch("/api/trees/{tree_id}", response_model=TreeShort)
def update_tree(
    tree_id: int,
    data: TreeUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    tree = get_tree_or_403(tree_id, user, db)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tree, k, v)
    db.commit()
    db.refresh(tree)
    return tree


@app.delete("/api/trees/{tree_id}", status_code=204)
def delete_tree(tree_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    tree = get_tree_or_403(tree_id, user, db)
    db.delete(tree)
    db.commit()


def _build_graph(tree: Tree, can_edit: bool, db: Session) -> TreeGraphResponse:
    individuals = db.scalars(
        select(Individual)
        .where(Individual.tree_id == tree.id, Individual.deleted_at.is_(None))
        .order_by(Individual.id)
    ).all()
    person_ids = {i.id for i in individuals}

    families_raw = db.scalars(
        select(Family)
        .where(Family.tree_id == tree.id, Family.deleted_at.is_(None))
        .order_by(Family.id)
    ).all()

    associations = db.scalars(
        select(Association)
        .where(Association.tree_id == tree.id)
        .order_by(Association.id)
    ).all()

    family_ids_all = [f.id for f in families_raw]
    child_links_all = (
        db.scalars(
            select(FamilyChild).where(FamilyChild.family_id.in_(family_ids_all))
        ).all()
        if family_ids_all
        else []
    )
    child_links_all = [fc for fc in child_links_all if fc.child_id in person_ids]

    # ⚠️ Семья существует, только если ОБА супруга живы
    intact_families = [
        f for f in families_raw
        if f.spouse1_id in person_ids and f.spouse2_id in person_ids
    ]

    orphaned_links = []
    for f in families_raw:
        if f in intact_families:
            continue
        live_parents = [
            pid for pid in (f.spouse1_id, f.spouse2_id)
            if pid is not None and pid in person_ids
        ]
        if len(live_parents) == 0:
            continue
        links_in_family = [fc for fc in child_links_all if fc.family_id == f.id]
        for fc in links_in_family:
            for parent_id in live_parents:
                orphaned_links.append((f.id, parent_id, fc.child_id, fc.relationship_type))

    families = intact_families
    family_ids = {f.id for f in families}
    child_links = [fc for fc in child_links_all if fc.family_id in family_ids]

    persons = [
        TreeNode(
            id=i.id,
            first_name=i.first_name,
            last_name=i.last_name,
            patronymic=i.patronymic,
            gender=i.gender,
            is_alive=i.is_alive,
            photo_url=i.photo_url,
            birth_date=i.birth_date,
        )
        for i in individuals
    ]

    family_nodes = [
        TreeFamilyNode(
            id=f.id,
            spouse1_id=f.spouse1_id,
            spouse2_id=f.spouse2_id,
            status=f.status,
        )
        for f in families
    ]

    marriage_edges = [
        TreeMarriageEdge(
            family_id=f.id,
            source_id=f.spouse1_id,
            target_id=f.spouse2_id,
        )
        for f in families
    ]

    child_edges = [
        TreeChildEdge(
            family_id=fc.family_id,
            child_id=fc.child_id,
            relationship_type=fc.relationship_type,
        )
        for fc in child_links
    ]

    # ⚠️ Прямые рёбра (без family-node) — для осиротевших семей
    orphaned_parent_edges = [
        TreeOrphanParentEdge(
            family_id=fid,
            parent_id=pid,
            child_id=cid,
            relationship_type=rel_type,
        )
        for fid, pid, cid, rel_type in orphaned_links
    ]

    association_edges = [
        TreeAssociationEdge(
            id=a.id,
            type=a.type,
            source_id=a.from_id,
            target_id=a.to_id,
        )
        for a in associations
        if a.from_id in person_ids and a.to_id in person_ids
    ]

    return TreeGraphResponse(
        tree_id=tree.id,
        tree_name=tree.name,
        owner_id=tree.owner_id,
        can_edit=can_edit,
        persons=persons,
        families=family_nodes,
        marriage_edges=marriage_edges,
        child_edges=child_edges,
        orphaned_parent_edges=orphaned_parent_edges,
        association_edges=association_edges,
    )


@app.get("/api/graph", response_model=TreeGraphResponse)
def get_current_graph(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Универсальный эндпоинт для холста.
    - Авторизован → его первое дерево, can_edit=true
    - Гость → дерево demo-пользователя (email="demo@local"), can_edit=false
    """
    if user:
        tree = get_or_create_default_tree(user, db)
        return _build_graph(tree, can_edit=True, db=db)

    # Гость — смотрим дерево demo
    demo = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if not demo:
        # Демо-дерева нет → пустой граф
        return TreeGraphResponse(
            tree_id=0, tree_name="", owner_id=0, can_edit=False,
            persons=[], families=[],
            marriage_edges=[], child_edges=[], association_edges=[],
        )

    demo_tree = db.scalar(
        select(Tree).where(Tree.owner_id == demo.id).order_by(Tree.id)
    )
    if not demo_tree:
        return TreeGraphResponse(
            tree_id=0, tree_name="", owner_id=demo.id, can_edit=False,
            persons=[], families=[],
            marriage_edges=[], child_edges=[], association_edges=[],
        )

    return _build_graph(demo_tree, can_edit=False, db=db)


@app.get("/api/trees/{tree_id}/graph", response_model=TreeGraphResponse)
def get_tree_graph(
    tree_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    tree = get_tree_or_403(tree_id, user, db)
    return _build_graph(tree, can_edit=True, db=db)


# Individual CRUD
def get_individual_or_403(
    individual_id: int,
    user: User,
    db: Session,
) -> Individual:
    ind = db.get(Individual, individual_id)
    if not ind or ind.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Персона не найдена")
    tree = db.get(Tree, ind.tree_id)
    if not tree or tree.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return ind


def _family_short_with_children(
    fam: Family,
    children: List[Individual],
    live_person_ids: set,
) -> FamilyShort:
    return FamilyShort(
        id=fam.id,
        spouse1_id=fam.spouse1_id if fam.spouse1_id in live_person_ids else None,
        spouse2_id=fam.spouse2_id if fam.spouse2_id in live_person_ids else None,
        status=fam.status,
        marriage_date=fam.marriage_date,
        divorce_date=fam.divorce_date,
        children=[IndividualShort.model_validate(c) for c in children],
    )


def _individual_to_detail(ind: Individual, db: Session) -> IndividualDetail:
    # Все живые персоны дерева — для проверки перед отдачей в ответ
    live_person_ids = set(
        db.scalars(
            select(Individual.id).where(
                Individual.tree_id == ind.tree_id,
                Individual.deleted_at.is_(None),
            )
        ).all()
    )

    # --- parent_families: семьи, где ind — ребёнок ---
    parent_links = db.scalars(
        select(FamilyChild).where(FamilyChild.child_id == ind.id)
    ).all()
    parent_family_ids = [fc.family_id for fc in parent_links]

    parent_families_raw = (
        db.scalars(
            select(Family).where(
                Family.id.in_(parent_family_ids),
                Family.deleted_at.is_(None),
            )
        ).all()
        if parent_family_ids
        else []
    )

    parent_families_filtered = [
        f for f in parent_families_raw
        if (f.spouse1_id in live_person_ids) or (f.spouse2_id in live_person_ids)
    ]

    # --- spouse_families: семьи, где ind — супруг ---
    spouse_families_raw = db.scalars(
        select(Family).where(
            (Family.spouse1_id == ind.id) | (Family.spouse2_id == ind.id),
            Family.deleted_at.is_(None),
        )
    ).all()

    spouse_families_payload = []
    for fam in spouse_families_raw:
        links = db.scalars(
            select(FamilyChild).where(FamilyChild.family_id == fam.id)
        ).all()
        child_ids = [l.child_id for l in links if l.child_id in live_person_ids]
        children = (
            db.scalars(select(Individual).where(Individual.id.in_(child_ids))).all()
            if child_ids
            else []
        )
        spouse_families_payload.append(
            _family_short_with_children(fam, children, live_person_ids)
        )

    return IndividualDetail(
        id=ind.id,
        tree_id=ind.tree_id,
        gedcom_xref=ind.gedcom_xref,
        first_name=ind.first_name,
        last_name=ind.last_name,
        patronymic=ind.patronymic,
        maiden_name=ind.maiden_name,
        nicknames=ind.nicknames,
        aliases=ind.aliases,
        gender=ind.gender,
        is_alive=ind.is_alive,
        biography=ind.biography,
        photo_url=ind.photo_url,
        birth_date=ind.birth_date,
        birth_place=ind.birth_place,
        death_date=ind.death_date,
        death_place=ind.death_place,
        created_at=ind.created_at,
        updated_at=ind.updated_at,
        parent_families=[
            _family_short_with_children(f, [], live_person_ids)
            for f in parent_families_filtered
        ],
        spouse_families=spouse_families_payload,
    )


@app.post("/api/trees/{tree_id}/individuals", response_model=IndividualDetail, status_code=201)
def create_individual(
    tree_id: int,
    data: IndividualCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    tree = get_tree_or_403(tree_id, user, db)

    ind = Individual(tree_id=tree.id, **data.model_dump())
    db.add(ind)
    db.commit()
    db.refresh(ind)

    # Если is_alive == False и death_date задан — обновим флаг
    if ind.is_alive and ind.death_date:
        ind.is_alive = False
        db.commit()
        db.refresh(ind)

    return _individual_to_detail(ind, db)


@app.get("/api/individuals/{individual_id}", response_model=IndividualDetail)
def get_individual(
    individual_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    ind = get_individual_or_403(individual_id, user, db)
    return _individual_to_detail(ind, db)


@app.patch("/api/individuals/{individual_id}", response_model=IndividualDetail)
def update_individual(
    individual_id: int,
    data: IndividualUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    ind = get_individual_or_403(individual_id, user, db)

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ind, k, v)

    # Автообновление is_alive
    if ind.death_date and ind.is_alive:
        ind.is_alive = False

    db.commit()
    db.refresh(ind)
    return _individual_to_detail(ind, db)


@app.delete("/api/individuals/{individual_id}", status_code=204)
def delete_individual(
    individual_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Удаление человека с полной очисткой связей:
    1. Удаляем FamilyChild, где он ребёнок
    2. В семьях, где он супруг — обнуляем spouse1/spouse2
    3. Удаляем ассоциации (крёстные и др.)
    4. Soft-delete человека
    5. Опустевшие семьи (нет супругов и детей) — soft-delete
    """
    ind = get_individual_or_403(individual_id, user, db)

    # 1. Убрать его как ребёнка из всех семей
    child_links = db.scalars(
        select(FamilyChild).where(FamilyChild.child_id == ind.id)
    ).all()
    for link in child_links:
        db.delete(link)

    # 2. Семьи, где он супруг — обнулить spouse_id
    spouse_families = db.scalars(
        select(Family).where(
            (Family.spouse1_id == ind.id) | (Family.spouse2_id == ind.id),
            Family.deleted_at.is_(None),
        )
    ).all()
    for fam in spouse_families:
        if fam.spouse1_id == ind.id:
            fam.spouse1_id = None
        if fam.spouse2_id == ind.id:
            fam.spouse2_id = None

    # 3. Удалить ассоциации
    associations = db.scalars(
        select(Association).where(
            (Association.from_id == ind.id) | (Association.to_id == ind.id)
        )
    ).all()
    for a in associations:
        db.delete(a)

    # 4. Soft-delete персону
    ind.deleted_at = datetime.utcnow()

    db.commit()

    # 5. Опустевшие семьи — soft-delete
    for fam in spouse_families:
        db.refresh(fam)
        child_count = db.scalar(
            select(func.count(FamilyChild.child_id))
            .where(FamilyChild.family_id == fam.id)
        ) or 0
        if fam.spouse1_id is None and fam.spouse2_id is None and child_count == 0:
            fam.deleted_at = datetime.utcnow()

    db.commit()


# ---------------------------------------------------------------------------
# Family CRUD
# ---------------------------------------------------------------------------

def get_family_or_403(family_id: int, user: User, db: Session) -> Family:
    fam = db.get(Family, family_id)
    if not fam or fam.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Семья не найдена")
    tree = db.get(Tree, fam.tree_id)
    if not tree or tree.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return fam


def _validate_individual_in_tree(individual_id: int, tree_id: int, db: Session):
    ind = db.get(Individual, individual_id)
    if not ind or ind.deleted_at is not None or ind.tree_id != tree_id:
        raise HTTPException(
            status_code=400,
            detail=f"Персона {individual_id} не найдена в этом дереве",
        )


def _family_to_detail(fam: Family, db: Session) -> FamilyDetail:
    # Не показывать soft-deleted супругов
    spouse1_raw = db.get(Individual, fam.spouse1_id) if fam.spouse1_id else None
    spouse2_raw = db.get(Individual, fam.spouse2_id) if fam.spouse2_id else None
    spouse1 = spouse1_raw if spouse1_raw and spouse1_raw.deleted_at is None else None
    spouse2 = spouse2_raw if spouse2_raw and spouse2_raw.deleted_at is None else None

    links = db.scalars(
        select(FamilyChild).where(FamilyChild.family_id == fam.id)
    ).all()
    child_ids = [l.child_id for l in links]
    children = (
        db.scalars(
            select(Individual).where(
                Individual.id.in_(child_ids),
                Individual.deleted_at.is_(None),
            )
        ).all()
        if child_ids
        else []
    )

    return FamilyDetail(
        id=fam.id,
        tree_id=fam.tree_id,
        gedcom_xref=fam.gedcom_xref,
        spouse1_id=fam.spouse1_id if spouse1 else None,
        spouse2_id=fam.spouse2_id if spouse2 else None,
        status=fam.status,
        marriage_date=fam.marriage_date,
        marriage_place=fam.marriage_place,
        divorce_date=fam.divorce_date,
        note=fam.note,
        created_at=fam.created_at,
        updated_at=fam.updated_at,
        spouse1=IndividualShort.model_validate(spouse1) if spouse1 else None,
        spouse2=IndividualShort.model_validate(spouse2) if spouse2 else None,
        children=[IndividualShort.model_validate(c) for c in children],
        children_links=[
            FamilyChildShort(
                family_id=l.family_id,
                child_id=l.child_id,
                relationship_type=l.relationship_type,
            )
            for l in links
        ],
    )


@app.post("/api/trees/{tree_id}/families", response_model=FamilyDetail, status_code=201)
def create_family(
    tree_id: int,
    data: FamilyCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    tree = get_tree_or_403(tree_id, user, db)

    if data.spouse1_id is not None and data.spouse2_id is not None:
        if data.spouse1_id == data.spouse2_id:
            raise HTTPException(status_code=400, detail="Супруги не могут быть одним человеком")
        _validate_individual_in_tree(data.spouse1_id, tree.id, db)
        _validate_individual_in_tree(data.spouse2_id, tree.id, db)

        # Проверка дубля: активная семья между этими двумя уже есть?
        existing = db.scalar(
            select(Family).where(
                Family.tree_id == tree.id,
                Family.deleted_at.is_(None),
                Family.status != FamilyStatus.DIVORCED,
                (
                    ((Family.spouse1_id == data.spouse1_id) & (Family.spouse2_id == data.spouse2_id))
                    | ((Family.spouse1_id == data.spouse2_id) & (Family.spouse2_id == data.spouse1_id))
                ),
            )
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Семья между этими людьми уже существует",
            )

    fam = Family(tree_id=tree.id, **data.model_dump())
    db.add(fam)
    db.commit()
    db.refresh(fam)
    return _family_to_detail(fam, db)


@app.get("/api/families/{family_id}", response_model=FamilyDetail)
def get_family(
    family_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    fam = get_family_or_403(family_id, user, db)
    return _family_to_detail(fam, db)


@app.patch("/api/families/{family_id}", response_model=FamilyDetail)
def update_family(
    family_id: int,
    data: FamilyUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    fam = get_family_or_403(family_id, user, db)

    payload = data.model_dump(exclude_unset=True)

    for spouse_key in ("spouse1_id", "spouse2_id"):
        if spouse_key in payload and payload[spouse_key] is not None:
            _validate_individual_in_tree(payload[spouse_key], fam.tree_id, db)

    # Нельзя одного и того же в spouse1 и spouse2
    s1 = payload.get("spouse1_id", fam.spouse1_id)
    s2 = payload.get("spouse2_id", fam.spouse2_id)
    if s1 is not None and s1 == s2:
        raise HTTPException(status_code=400, detail="Супруги не могут быть одним человеком")

    for k, v in payload.items():
        setattr(fam, k, v)

    db.commit()
    db.refresh(fam)
    return _family_to_detail(fam, db)


@app.delete("/api/families/{family_id}", status_code=204)
def delete_family(
    family_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Soft delete: помечаем deleted_at. Дети и события остаются в БД."""
    fam = get_family_or_403(family_id, user, db)
    fam.deleted_at = datetime.utcnow()
    db.commit()


# FamilyChild — ребёнок в семье
@app.post("/api/family-children", response_model=FamilyChildShort, status_code=201)
def add_child_to_family(
    data: FamilyChildCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    fam = get_family_or_403(data.family_id, user, db)
    _validate_individual_in_tree(data.child_id, fam.tree_id, db)

    # Нельзя, чтобы ребёнок был одним из супругов
    if data.child_id in (fam.spouse1_id, fam.spouse2_id):
        raise HTTPException(
            status_code=400,
            detail="Ребёнок не может быть одним из супругов семьи",
        )

    # Дубль?
    existing = db.get(FamilyChild, (data.family_id, data.child_id))
    if existing:
        # Обновим тип связи (например, с biological на adoptive)
        existing.relationship_type = data.relationship_type
        db.commit()
        return FamilyChildShort(
            family_id=existing.family_id,
            child_id=existing.child_id,
            relationship_type=existing.relationship_type,
        )

    link = FamilyChild(
        family_id=data.family_id,
        child_id=data.child_id,
        relationship_type=data.relationship_type,
    )
    db.add(link)
    db.commit()
    return FamilyChildShort(
        family_id=link.family_id,
        child_id=link.child_id,
        relationship_type=link.relationship_type,
    )


@app.delete("/api/family-children/{family_id}/{child_id}", status_code=204)
def remove_child_from_family(
    family_id: int,
    child_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    fam = get_family_or_403(family_id, user, db)
    link = db.get(FamilyChild, (fam.id, child_id))
    if not link:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    db.delete(link)
    db.commit()


# Association (крёстные, свидетели, опекуны)
@app.post("/api/trees/{tree_id}/associations", response_model=AssociationShort, status_code=201)
def create_association(
    tree_id: int,
    data: AssociationCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    tree = get_tree_or_403(tree_id, user, db)

    if data.from_id == data.to_id:
        raise HTTPException(status_code=400, detail="Нельзя связать человека с самим собой")

    _validate_individual_in_tree(data.from_id, tree.id, db)
    _validate_individual_in_tree(data.to_id, tree.id, db)

    existing = db.scalar(
        select(Association).where(
            Association.tree_id == tree.id,
            Association.type == data.type,
            Association.from_id == data.from_id,
            Association.to_id == data.to_id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Такая связь уже существует")

    assoc = Association(tree_id=tree.id, **data.model_dump())
    db.add(assoc)
    db.commit()
    db.refresh(assoc)
    return assoc


@app.delete("/api/associations/{association_id}", status_code=204)
def delete_association(
    association_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    assoc = db.get(Association, association_id)
    if not assoc:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    tree = db.get(Tree, assoc.tree_id)
    if not tree or tree.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    db.delete(assoc)
    db.commit()