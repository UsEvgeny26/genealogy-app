from datetime import datetime, timedelta
from typing import List, Optional
import uuid
from pathlib import Path as FilePath
import tempfile

from fastapi import Depends, FastAPI, HTTPException, Response, status, File, UploadFile, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select, event, or_
from sqlalchemy.orm import Session, joinedload
from fastapi.responses import PlainTextResponse
from urllib.parse import quote

from gedcom_export import export_gedcom as export_gedcom_str
from auth import (
    clear_session_cookie,
    create_session,
    delete_session,
    get_current_session_id,
    get_current_user,
    hash_password,
    needs_rehash,
    require_user,
    set_session_cookie,
    verify_password,
)
from database import engine, get_db
from models import (
    Association, AssociationType, Base,
    Event, EventType,
    Family, FamilyChild, FamilyStatus,
    Individual, Place, Tree, User,
)
from schemas import (
    AssociationCreate, AssociationShort,
    EventCreate, EventShort, EventUpdate,
    FamilyCreate, FamilyDetail, FamilyShort, FamilyUpdate,
    FamilyChildCreate, FamilyChildShort,
    IndividualCreate, IndividualDetail, IndividualShort, IndividualUpdate,
    LoginRequest, PlaceShort,
    TreeCreate, TreeListItem, TreeNode, TreeShort,
    TreeStats, TreeUpdate, TreeGraphResponse, TreeFamilyNode,
    TreeMarriageEdge, TreeChildEdge, TreeAssociationEdge,
    UserCreate, UserPublic, TreeOrphanParentEdge, PositionBulkUpdate,
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

# Uploads
UPLOADS_DIR = FilePath("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


@app.post("/api/upload")
async def upload_image(
        file: UploadFile = File(...),
        tree_id: Optional[int] = Form(None),
        user: User = Depends(require_user),
):
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, detail="Допустимы только JPG, PNG, WebP, GIF")

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(400, detail="Файл больше 5 МБ")
    if not content:
        raise HTTPException(400, detail="Пустой файл")

    ext = ALLOWED_IMAGE_TYPES[file.content_type]
    # Формируем уникальное имя: tree_1_user_2_a1b2c3d4.jpg
    unique_hash = uuid.uuid4().hex
    tree_part = f"tree_{tree_id}_" if tree_id else ""
    filename = f"{tree_part}user_{user.id}_{unique_hash}{ext}"

    target = UPLOADS_DIR / filename

    with open(target, "wb") as f:
        f.write(content)

    return {"url": f"/uploads/{filename}"}

# Утилиты
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
def register(
    data: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
):
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

    get_or_create_default_tree(user, db)

    # Автологин после регистрации
    session = create_session(user.id, db)
    set_session_cookie(response, session.id)

    return serialize_user(user)


@app.post("/api/auth/login", response_model=UserPublic)
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.email == data.email))
    if not user or not user.password_hash or not verify_password(
        data.password, user.password_hash
    ):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Пользователь деактивирован")

    # Рехешируем legacy-пароль на bcrypt
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)
        db.commit()

    session = create_session(user.id, db)
    set_session_cookie(response, session.id)

    return serialize_user(user)


@app.get("/api/auth/me", response_model=UserPublic)
def get_me(user: User = Depends(require_user)):
    return serialize_user(user)


@app.post("/api/auth/logout", status_code=204)
def logout(
    response: Response,
    session_id: Optional[str] = Depends(get_current_session_id),
    db: Session = Depends(get_db),
):
    if session_id:
        delete_session(session_id, db)
    clear_session_cookie(response)
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
            death_date=i.death_date,
            pos_x=i.pos_x,
            pos_y=i.pos_y,
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
        tree_id: Optional[int] = None,
        user: Optional[User] = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    if tree_id is not None:
        tree = db.get(Tree, tree_id)
        if not tree:
            raise HTTPException(404, detail="Дерево не найдено")

        # Если дерево временное — отдаём его любому желающему, но только для чтения
        if tree.is_temporary:
            return _build_graph(tree, can_edit=False, db=db)

        # Если дерево обычное — проверяем владельца
        if user and tree.owner_id == user.id:
            return _build_graph(tree, can_edit=True, db=db)
        else:
            raise HTTPException(403, detail="Нет доступа к этому дереву")

    if user:
        tree = get_or_create_default_tree(user, db)
        return _build_graph(tree, can_edit=True, db=db)

    # Гость без tree_id — смотрит демо-дерево
    demo = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if demo:
        demo_tree = db.scalar(select(Tree).where(Tree.owner_id == demo.id).order_by(Tree.id))
        if demo_tree:
            return _build_graph(demo_tree, can_edit=False, db=db)

    return TreeGraphResponse(
        tree_id=0, tree_name="", owner_id=0, can_edit=False,
        persons=[], families=[], marriage_edges=[], child_edges=[], association_edges=[],
    )



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

        # События: собственные + семейные (брак/развод)
        spouse_family_ids = [f.id for f in spouse_families_raw]

        conditions = [Event.individual_id == ind.id]
        if spouse_family_ids:
            conditions.append(Event.family_id.in_(spouse_family_ids))

        events = db.scalars(
            select(Event)
            .where(or_(*conditions))
            .order_by(Event.id)
        ).all()

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
        events=[_event_to_short(e) for e in events],
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


# Family CRUD

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


# Утилиты для событий и мест
def _get_or_create_place(tree_id: int, name: Optional[str], db: Session) -> Optional[int]:
    """Возвращает id существующего Place или создаёт новый по имени. None если имя пустое."""
    if not name:
        return None
    name = name.strip()
    if not name:
        return None

    existing = db.scalar(
        select(Place).where(Place.tree_id == tree_id, Place.name == name)
    )
    if existing:
        return existing.id

    place = Place(tree_id=tree_id, name=name)
    db.add(place)
    db.flush()
    return place.id


def _sync_individual_dates(ind: Individual, db: Session) -> None:
    """
    Пересчитывает денормализованные поля Individual (birth_date/birth_place/death_date/death_place/is_alive)
    из событий BIRT и DEAT. Вызывать после создания/обновления/удаления такого события.
    """
    events = db.scalars(
        select(Event).where(Event.individual_id == ind.id)
    ).all()

    birth = next((e for e in events if e.event_type == EventType.BIRTH), None)
    death = next((e for e in events if e.event_type == EventType.DEATH), None)

    ind.birth_date = birth.date_str if birth else None
    ind.birth_place = birth.place.name if (birth and birth.place_id) else None
    ind.death_date = death.date_str if death else None
    ind.death_place = death.place.name if (death and death.place_id) else None
    if death and death.date_str:
        ind.is_alive = False

# Events — CRUD
def get_event_or_403(event_id: int, user: User, db: Session) -> Event:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    tree = db.get(Tree, event.tree_id)
    if not tree or tree.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return event


def _event_to_short(event: Event) -> EventShort:
    return EventShort(
        id=event.id,
        event_type=event.event_type,
        date_str=event.date_str,
        description=event.description,
        individual_id=event.individual_id,
        family_id=event.family_id,
        place=PlaceShort.model_validate(event.place) if event.place else None,
    )


@app.post("/api/individuals/{individual_id}/events", response_model=EventShort, status_code=201)
def create_individual_event(
    individual_id: int,
    data: EventCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    ind = get_individual_or_403(individual_id, user, db)

    if data.family_id is not None:
        raise HTTPException(400, detail="Событие не может быть привязано и к персоне, и к семье")

    place_id = data.place_id or _get_or_create_place(ind.tree_id, data.place_name, db)

    event = Event(
        tree_id=ind.tree_id,
        individual_id=ind.id,
        family_id=None,
        event_type=data.event_type,
        date_str=data.date_str,
        place_id=place_id,
        description=data.description,
    )
    db.add(event)
    db.flush()

    if event.event_type in (EventType.BIRTH, EventType.DEATH):
        _sync_individual_dates(ind, db)

    db.commit()
    db.refresh(event)
    return _event_to_short(event)


@app.post("/api/families/{family_id}/events", response_model=EventShort, status_code=201)
def create_family_event(
    family_id: int,
    data: EventCreate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    fam = get_family_or_403(family_id, user, db)

    if data.individual_id is not None:
        raise HTTPException(400, detail="Событие не может быть привязано и к семье, и к персоне")

    place_id = data.place_id or _get_or_create_place(fam.tree_id, data.place_name, db)

    event = Event(
        tree_id=fam.tree_id,
        individual_id=None,
        family_id=fam.id,
        event_type=data.event_type,
        date_str=data.date_str,
        place_id=place_id,
        description=data.description,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_to_short(event)


@app.patch("/api/events/{event_id}", response_model=EventShort)
def update_event(
    event_id: int,
    data: EventUpdate,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    event = get_event_or_403(event_id, user, db)
    old_type = event.event_type
    payload = data.model_dump(exclude_unset=True)

    # place_name → place_id
    if "place_name" in payload:
        pn = payload.pop("place_name")
        if pn is not None:
            payload["place_id"] = _get_or_create_place(event.tree_id, pn, db)

    for k, v in payload.items():
        setattr(event, k, v)

    db.flush()

    # Если тип или дата события влияет на денормализацию персоны
    if event.individual_id and (
        old_type in (EventType.BIRTH, EventType.DEATH)
        or event.event_type in (EventType.BIRTH, EventType.DEATH)
    ):
        ind = db.get(Individual, event.individual_id)
        if ind:
            _sync_individual_dates(ind, db)

    db.commit()
    db.refresh(event)
    return _event_to_short(event)


@app.delete("/api/events/{event_id}", status_code=204)
def delete_event(
    event_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    event = get_event_or_403(event_id, user, db)
    ind_id = event.individual_id
    was_birth_or_death = event.event_type in (EventType.BIRTH, EventType.DEATH)

    db.delete(event)
    db.flush()

    if ind_id and was_birth_or_death:
        ind = db.get(Individual, ind_id)
        if ind:
            _sync_individual_dates(ind, db)

    db.commit()

# Places
@app.get("/api/trees/{tree_id}/places", response_model=List[PlaceShort])
def list_places(
    tree_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    get_tree_or_403(tree_id, user, db)
    places = db.scalars(
        select(Place).where(Place.tree_id == tree_id).order_by(Place.name)
    ).all()
    return [PlaceShort.model_validate(p) for p in places]

def _sync_family_events(fam: Family, db: Session) -> None:
    """Автоматически создает/обновляет события брака и развода."""
    # Синхронизация брака (MARR)
    marr = db.scalar(select(Event).where(Event.family_id == fam.id, Event.event_type == EventType.MARRIAGE))
    if fam.marriage_date:
        if marr:
            marr.date_str = fam.marriage_date
        else:
            db.add(Event(tree_id=fam.tree_id, family_id=fam.id, event_type=EventType.MARRIAGE, date_str=fam.marriage_date))
    elif marr:
        db.delete(marr)

    # Синхронизация развода (DIV)
    div = db.scalar(select(Event).where(Event.family_id == fam.id, Event.event_type == EventType.DIVORCE))
    if fam.divorce_date:
        if div:
            div.date_str = fam.divorce_date
        else:
            db.add(Event(tree_id=fam.tree_id, family_id=fam.id, event_type=EventType.DIVORCE, date_str=fam.divorce_date))
    elif div:
        db.delete(div)

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

        # У человека может быть только 1 действующий супруг
        for spouse_id in (data.spouse1_id, data.spouse2_id):
            active_marriage = db.scalar(
                select(Family).where(
                    Family.tree_id == tree.id,
                    Family.deleted_at.is_(None),
                    Family.status.in_([FamilyStatus.MARRIED, FamilyStatus.PARTNERS]),
                    (Family.spouse1_id == spouse_id) | (Family.spouse2_id == spouse_id)
                )
            )
            if active_marriage:
                raise HTTPException(
                    status_code=400,
                    detail="У этого человека уже есть действующий супруг(а). Сначала оформите развод."
                )

        # Проверка дубля (как было)
        existing = db.scalar(
            select(Family).where(
                Family.tree_id == tree.id,
                Family.deleted_at.is_(None),
                (
                    ((Family.spouse1_id == data.spouse1_id) & (Family.spouse2_id == data.spouse2_id))
                    | ((Family.spouse1_id == data.spouse2_id) & (Family.spouse2_id == data.spouse1_id))
                ),
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Семья между этими людьми уже существует")

    fam = Family(tree_id=tree.id, **data.model_dump())
    db.add(fam)
    db.flush() # Нужно, чтобы получить fam.id

    # АВТОСОЗДАНИЕ СОБЫТИЙ
    _sync_family_events(fam, db)

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

    _sync_family_events(fam, db)
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


# Экспорт GEDCOM
@app.get("/api/trees/{tree_id}/export-gedcom")
def export_gedcom_endpoint(
    tree_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    tree = get_tree_or_403(tree_id, user, db)

    individuals = db.scalars(
        select(Individual)
        .where(Individual.tree_id == tree.id, Individual.deleted_at.is_(None))
        .order_by(Individual.id)
    ).all()

    families = db.scalars(
        select(Family)
        .where(Family.tree_id == tree.id, Family.deleted_at.is_(None))
        .order_by(Family.id)
    ).all()

    family_ids = [f.id for f in families]
    family_children = (
        db.scalars(
            select(FamilyChild).where(FamilyChild.family_id.in_(family_ids))
        ).all()
        if family_ids
        else []
    )

    events = db.scalars(
        select(Event).where(Event.tree_id == tree.id).order_by(Event.id)
    ).all()

    content = export_gedcom_str(tree, individuals, families, family_children, events)

    safe_name = (
            "".join(
                c if c.isalnum() or c in "-_ " else "_"
                for c in (tree.name or "tree")
            ).strip()
            or "tree"
    )
    ascii_fallback = "tree.ged"
    utf8_name = quote(f"{safe_name}.ged")

    return PlainTextResponse(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"{ascii_fallback}\"; "
                f"filename*=UTF-8''{utf8_name}"
            ),
        },
    )
# Импорт GEDCOM
@app.post("/api/trees/import-gedcom", response_model=TreeShort, status_code=201)
async def import_gedcom_endpoint(
    file: UploadFile = File(...),
    tree_name: Optional[str] = Form(None),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    Импортирует .ged в новое дерево пользователя.
    Возвращает созданное дерево.
    """
    if not file.filename:
        raise HTTPException(400, detail="Файл не выбран")

    if not file.filename.lower().endswith((".ged", ".txt")):
        raise HTTPException(400, detail="Поддерживаются только файлы .ged или .txt")

    content = await file.read()
    if not content:
        raise HTTPException(400, detail="Файл пустой")

    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, detail="Файл слишком большой (макс 20 МБ)")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=".ged", delete=False
        ) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        name = (
            tree_name
            or (file.filename and FilePath(file.filename).stem)
            or "Импортированное дерево"
        )
        tree = Tree(owner_id=user.id, name=name)
        db.add(tree)
        db.flush()

        from gedcom_import import import_gedcom as _import_ged

        try:
            counts = _import_ged(tmp_path, tree.id, db)
        except Exception as e:
            db.rollback()
            raise HTTPException(400, detail=f"Ошибка импорта: {e}")

        db.commit()
        db.refresh(tree)
        print(f"[import-gedcom] tree={tree.id} {counts}")
        return tree

    finally:
        if tmp_path:
            try:
                FilePath(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass


# Автоматическое обновление Tree.updated_at при любых изменениях внутри дерева
@event.listens_for(Session, "before_flush")
def update_tree_timestamp(session, flush_context, instances):
    from models import Individual, Family, Event, Association
    touched_tree_ids = set()

    for obj in session.new.union(session.dirty).union(session.deleted):
        if isinstance(obj, (Individual, Family, Event, Association)) and hasattr(obj, 'tree_id') and obj.tree_id:
            touched_tree_ids.add(obj.tree_id)

    if touched_tree_ids:
        from sqlalchemy import update
        from models import Tree

        # Принудительно обновляем прямо в базе через update()
        for tree_id in touched_tree_ids:
            session.execute(
                update(Tree)
                .where(Tree.id == tree_id)
                .values(updated_at=datetime.utcnow())
            )


def cleanup_temp_trees(db: Session):
    """Удаляет гостевые деревья старше 24 часов."""
    yesterday = datetime.utcnow() - timedelta(hours=24)
    old_trees = db.scalars(
        select(Tree).where(Tree.is_temporary == True, Tree.created_at < yesterday)
    ).all()
    for t in old_trees:
        db.delete(t)
    if old_trees:
        db.commit()


@app.post("/api/guest/import-gedcom", response_model=TreeShort, status_code=201)
async def guest_import_gedcom(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
):
    cleanup_temp_trees(db)

    if not file.filename or not file.filename.lower().endswith((".ged", ".txt")):
        raise HTTPException(400, detail="Поддерживаются только файлы .ged или .txt")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, detail="Файл слишком большой (макс 20 МБ)")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".ged", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Создаем ВРЕМЕННОЕ дерево (owner_id=None, is_temporary=True)
        tree = Tree(
            name=f"Просмотр: {file.filename}",
            is_temporary=True,
            owner_id=None
        )
        db.add(tree)
        db.flush()

        from gedcom_import import import_gedcom as _import_ged
        try:
            _import_ged(tmp_path, tree.id, db)
        except Exception as e:
            db.rollback()
            raise HTTPException(400, detail=f"Ошибка импорта: {e}")

        db.commit()
        db.refresh(tree)
        return tree

    finally:
        if tmp_path:
            FilePath(tmp_path).unlink(missing_ok=True)


@app.patch("/api/trees/{tree_id}/positions")
def bulk_update_positions(
        tree_id: int,
        data: PositionBulkUpdate,
        user: User = Depends(require_user),
        db: Session = Depends(get_db),
):
    tree = get_tree_or_403(tree_id, user, db)

    # Обновляем координаты пакетно
    for item in data.positions:
        ind = db.get(Individual, item.id)
        if ind and ind.tree_id == tree.id:
            ind.pos_x = item.pos_x
            ind.pos_y = item.pos_y

    db.commit()
    return {"status": "ok", "updated": len(data.positions)}

