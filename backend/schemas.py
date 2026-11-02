from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from models import (
    AssociationType,
    ChildRelationType,
    EventType,
    FamilyStatus,
    Gender,
)


# Общие настройки
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# User / Auth
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    display_name: Optional[str] = Field(None, max_length=100)


class UserPublic(ORMModel):
    id: int
    email: str
    display_name: Optional[str] = None
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Tree
class TreeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class TreeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class TreeShort(ORMModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TreeStats(BaseModel):
    """Краткая статистика для карточки дерева в списке."""
    individuals_count: int = 0
    families_count: int = 0
    generations: int = 0


class TreeListItem(TreeShort):
    stats: TreeStats = TreeStats()

class TreeOrphanParentEdge(BaseModel):
    """
    Прямое ребро «родитель → ребёнок» для случая, когда второй супруг
    удалён и family-node не создаётся.
    """
    family_id: int
    parent_id: int
    child_id: int
    relationship_type: ChildRelationType


# Individual
class IndividualBase(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    patronymic: Optional[str] = Field(None, max_length=100)
    maiden_name: Optional[str] = Field(None, max_length=100)
    nicknames: Optional[str] = Field(None, max_length=255)
    aliases: Optional[str] = Field(None, max_length=255)
    gender: Gender = Gender.UNKNOWN
    is_alive: bool = True
    biography: Optional[str] = None
    photo_url: Optional[str] = Field(None, max_length=500)
    birth_date: Optional[str] = Field(None, max_length=100)
    birth_place: Optional[str] = Field(None, max_length=255)
    death_date: Optional[str] = Field(None, max_length=100)
    death_place: Optional[str] = Field(None, max_length=255)


class IndividualCreate(IndividualBase):
    pass


class IndividualUpdate(BaseModel):
    """Все поля опциональны — для частичного обновления (PATCH)."""
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    patronymic: Optional[str] = Field(None, max_length=100)
    maiden_name: Optional[str] = Field(None, max_length=100)
    nicknames: Optional[str] = Field(None, max_length=255)
    aliases: Optional[str] = Field(None, max_length=255)
    gender: Optional[Gender] = None
    is_alive: Optional[bool] = None
    biography: Optional[str] = None
    photo_url: Optional[str] = Field(None, max_length=500)
    birth_date: Optional[str] = Field(None, max_length=100)
    birth_place: Optional[str] = Field(None, max_length=255)
    death_date: Optional[str] = Field(None, max_length=100)
    death_place: Optional[str] = Field(None, max_length=255)


class IndividualShort(ORMModel):
    """Компактная карточка — для списков, узлов дерева, отображения связей."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    patronymic: Optional[str] = None
    gender: Gender
    is_alive: bool
    photo_url: Optional[str] = None
    birth_date: Optional[str] = None


class IndividualDetail(IndividualBase, ORMModel):
    id: int
    tree_id: int
    gedcom_xref: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Краткие сведения о семьях
    parent_families: List["FamilyShort"] = []
    spouse_families: List["FamilyShort"] = []


# Family / FamilyChild
class FamilyBase(BaseModel):
    spouse1_id: Optional[int] = None
    spouse2_id: Optional[int] = None
    status: FamilyStatus = FamilyStatus.MARRIED
    marriage_date: Optional[str] = Field(None, max_length=100)
    marriage_place: Optional[str] = Field(None, max_length=255)
    divorce_date: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None


class FamilyCreate(FamilyBase):
    pass


class FamilyUpdate(BaseModel):
    spouse1_id: Optional[int] = None
    spouse2_id: Optional[int] = None
    status: Optional[FamilyStatus] = None
    marriage_date: Optional[str] = Field(None, max_length=100)
    marriage_place: Optional[str] = Field(None, max_length=255)
    divorce_date: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = None


class FamilyShort(ORMModel):
    id: int
    spouse1_id: Optional[int] = None
    spouse2_id: Optional[int] = None
    status: FamilyStatus
    marriage_date: Optional[str] = None
    divorce_date: Optional[str] = None
    children: List[IndividualShort] = []  # ← новое

class FamilyChildShort(ORMModel):
    family_id: int
    child_id: int
    relationship_type: ChildRelationType


class FamilyDetail(FamilyShort):
    tree_id: int
    gedcom_xref: Optional[str] = None
    marriage_place: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    spouse1: Optional[IndividualShort] = None
    spouse2: Optional[IndividualShort] = None
    children: List[IndividualShort] = []
    children_links: List[FamilyChildShort] = []


class FamilyChildCreate(BaseModel):
    family_id: int
    child_id: int
    relationship_type: ChildRelationType = ChildRelationType.BIOLOGICAL


# Event / Place / Source / Citation / Media / Note
class EventBase(BaseModel):
    event_type: EventType
    date_str: Optional[str] = Field(None, max_length=100)
    place_id: Optional[int] = None
    description: Optional[str] = None
    individual_id: Optional[int] = None
    family_id: Optional[int] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    event_type: Optional[EventType] = None
    date_str: Optional[str] = Field(None, max_length=100)
    place_id: Optional[int] = None
    description: Optional[str] = None


class EventShort(ORMModel):
    id: int
    event_type: EventType
    date_str: Optional[str] = None
    place_id: Optional[int] = None


class PlaceBase(BaseModel):
    name: str = Field(..., max_length=255)
    latitude: Optional[str] = Field(None, max_length=20)
    longitude: Optional[str] = Field(None, max_length=20)


class PlaceCreate(PlaceBase):
    pass


class PlaceShort(PlaceBase, ORMModel):
    id: int


class SourceCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    author: Optional[str] = Field(None, max_length=255)
    publication: Optional[str] = Field(None, max_length=255)
    url: Optional[str] = Field(None, max_length=500)
    note: Optional[str] = None


class SourceShort(SourceCreate, ORMModel):
    id: int


class CitationCreate(BaseModel):
    event_id: int
    source_id: int
    page: Optional[str] = Field(None, max_length=100)
    confidence: Optional[str] = Field(None, max_length=20)


class CitationShort(CitationCreate, ORMModel):
    id: int


class MediaCreate(BaseModel):
    file_path: str = Field(..., max_length=500)
    mime_type: Optional[str] = Field(None, max_length=100)
    caption: Optional[str] = Field(None, max_length=255)
    individual_id: Optional[int] = None
    event_id: Optional[int] = None


class MediaShort(MediaCreate, ORMModel):
    id: int


class NoteCreate(BaseModel):
    text: str
    individual_id: Optional[int] = None
    family_id: Optional[int] = None
    event_id: Optional[int] = None


class NoteShort(NoteCreate, ORMModel):
    id: int


# Association (крёстные, свидетели и др.)

class AssociationCreate(BaseModel):
    type: AssociationType
    from_id: int
    to_id: int
    note: Optional[str] = None


class AssociationShort(ORMModel):
    id: int
    type: AssociationType
    from_id: int
    to_id: int
    note: Optional[str] = None


# Дерево для рендера (React Flow)
class TreeNode(ORMModel):
    """Компактный узел персоны для React Flow."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    patronymic: Optional[str] = None
    gender: Gender
    is_alive: bool
    photo_url: Optional[str] = None
    birth_date: Optional[str] = None


class TreeFamilyNode(ORMModel):
    """Узел семьи (FamilyNode в React Flow)."""
    id: int
    spouse1_id: Optional[int] = None
    spouse2_id: Optional[int] = None
    status: FamilyStatus


class TreeMarriageEdge(BaseModel):
    """Ребро между супругами."""
    family_id: int
    source_id: int
    target_id: int


class TreeChildEdge(BaseModel):
    """Ребро от семьи к ребёнку."""
    family_id: int
    child_id: int
    relationship_type: ChildRelationType


class TreeAssociationEdge(BaseModel):
    """Ребро ассоциации (крёстные и т.п.)."""
    id: int
    type: AssociationType
    source_id: int
    target_id: int


class TreeGraphResponse(BaseModel):
    tree_id: int
    tree_name: str
    owner_id: int
    can_edit: bool

    persons: List[TreeNode]
    families: List[TreeFamilyNode]
    marriage_edges: List[TreeMarriageEdge]
    child_edges: List[TreeChildEdge]
    orphaned_parent_edges: List[TreeOrphanParentEdge] = []
    association_edges: List[TreeAssociationEdge] = []

class TreeDetail(TreeShort):
    individuals: List[IndividualShort] = []
    families: List[FamilyShort] = []

# Forward refs

IndividualDetail.model_rebuild()
FamilyDetail.model_rebuild()