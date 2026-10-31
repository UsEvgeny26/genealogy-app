from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from models import Gender


# Базовая схема для создания и изменения персоны
class PersonBase(BaseModel):
    # 1. Персональные данные
    first_name: str = Field(..., min_length=1, max_length=100)
    given_name: Optional[str] = None
    last_name: Optional[str] = None
    patronymic: Optional[str] = None
    maiden_name: Optional[str] = None
    aliases: Optional[str] = None
    gender: Gender = Gender.UNKNOWN
    is_alive: bool = True
    photo_url: Optional[str] = None

    # 2. События
    birth_date: Optional[str] = None
    birth_place: Optional[str] = None
    death_date: Optional[str] = None
    death_place: Optional[str] = None
    death_cause: Optional[str] = None

    cemetery_name: Optional[str] = None
    cemetery_plot: Optional[str] = None
    cemetery_gps: Optional[str] = None

    immigration_date: Optional[str] = None
    immigration_port: Optional[str] = None
    immigration_doc: Optional[str] = None

    # 4. Социальный статус, карьера, образование
    occupations: Optional[str] = None
    education: Optional[str] = None
    social_status: Optional[str] = None

    military_is_served: Optional[bool] = False
    military_regiment: Optional[str] = None
    military_rank: Optional[str] = None
    military_battles: Optional[str] = None
    military_awards: Optional[str] = None

    religion: Optional[str] = None
    residences: Optional[str] = None

    # 5. Биография
    biography: Optional[str] = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    first_name: Optional[str] = None
    given_name: Optional[str] = None
    last_name: Optional[str] = None
    patronymic: Optional[str] = None
    maiden_name: Optional[str] = None
    aliases: Optional[str] = None
    gender: Optional[Gender] = None
    is_alive: Optional[bool] = None
    photo_url: Optional[str] = None

    birth_date: Optional[str] = None
    birth_place: Optional[str] = None
    death_date: Optional[str] = None
    death_place: Optional[str] = None
    death_cause: Optional[str] = None

    cemetery_name: Optional[str] = None
    cemetery_plot: Optional[str] = None
    cemetery_gps: Optional[str] = None

    immigration_date: Optional[str] = None
    immigration_port: Optional[str] = None
    immigration_doc: Optional[str] = None

    occupations: Optional[str] = None
    education: Optional[str] = None
    social_status: Optional[str] = None

    military_is_served: Optional[bool] = None
    military_regiment: Optional[str] = None
    military_rank: Optional[str] = None
    military_battles: Optional[str] = None
    military_awards: Optional[str] = None

    religion: Optional[str] = None
    residences: Optional[str] = None

    biography: Optional[str] = None


# Короткая карточка человека (для списков связей)
class PersonShort(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    patronymic: Optional[str] = None
    gender: Gender
    is_alive: bool
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


# Быстрый просмотр человека
class PersonDetail(PersonBase):
    id: int
    created_at: datetime
    updated_at: datetime
    parents: List[PersonShort] = []
    children: List[PersonShort] = []

    class Config:
        from_attributes = True


# Новый ответ для РАСШИРЕННОГО меню человека
class PersonExtendedDetail(PersonDetail):
    pass


# Структура графа для React Flow
class TreeNode(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    patronymic: Optional[str] = None
    gender: Gender
    is_alive: bool
    photo_url: Optional[str] = None


class ParentChildCreate(BaseModel):
    parent_id: int
    child_id: int
    kind: str = 'biological'  # 'biological' | 'adoptive'


class TreeEdge(BaseModel):
    source_id: int
    target_id: int
    kind: str = 'biological'


class MarriageCreate(BaseModel):
    spouse1_id: int
    spouse2_id: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None


class MarriageShort(BaseModel):
    id: int
    spouse1_id: int
    spouse2_id: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


class RelationCreate(BaseModel):
    type: str = Field(..., max_length=50)
    from_id: int
    to_id: int
    note: Optional[str] = None


class RelationShort(BaseModel):
    id: int
    type: str
    from_id: int
    to_id: int
    note: Optional[str] = None

    class Config:
        from_attributes = True


class MarriageUpdate(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None


class TreeDataResponse(BaseModel):
    nodes: List[TreeNode]
    edges: List[TreeEdge]
    marriages: List[MarriageShort] = []
    relations: List[RelationShort] = []


class UserPublic(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True