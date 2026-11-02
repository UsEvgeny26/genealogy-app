from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
    func,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


# Перечисления (GEDCOM-совместимые)

class Gender(str, Enum):
    """GEDCOM SEX: M (male), F (female), U (unknown)."""
    MALE = "M"
    FEMALE = "F"
    UNKNOWN = "U"


class ChildRelationType(str, Enum):
    """Тип связи ребёнка с семьёй."""
    BIOLOGICAL = "biological"
    ADOPTIVE = "adoptive"
    FOSTER = "foster"
    STEP = "step"


class FamilyStatus(str, Enum):
    """Статус брачного союза."""
    MARRIED = "married"
    DIVORCED = "divorced"
    WIDOWED = "widowed"
    PARTNERS = "partners"
    UNKNOWN = "unknown"


class EventType(str, Enum):
    """Типы событий — по GEDCOM-тегам."""
    BIRTH = "BIRT"
    DEATH = "DEAT"
    BURIAL = "BURI"
    CREMATION = "CREM"
    BAPTISM = "BAPM"
    MARRIAGE = "MARR"
    DIVORCE = "DIV"
    ENGAGEMENT = "ENGA"
    RESIDENCE = "RESI"
    OCCUPATION = "OCCU"
    EDUCATION = "EDUC"
    MILITARY = "MILI"
    IMMIGRATION = "IMMI"
    EMIGRATION = "EMIG"
    RELIGION = "RELI"
    OTHER = "OTHER"

class AssociationType(str, Enum):
    """GEDCOM ASSO — универсальные неродственные связи."""
    GODPARENT = "godparent"       # крёстный
    GODCHILD = "godchild"         # крестник (обратная связь)
    WITNESS = "witness"           # свидетель
    GUARDIAN = "guardian"         # опекун
    MENTOR = "mentor"             # наставник
    OTHER = "other"



# Пользователи и деревья
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    trees: Mapped[List["Tree"]] = relationship("Tree", back_populates="owner", cascade="all, delete-orphan")
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class Tree(Base):
    __tablename__ = "trees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Моё дерево")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped["User"] = relationship("User", back_populates="trees")
    individuals: Mapped[List["Individual"]] = relationship("Individual", back_populates="tree", cascade="all, delete-orphan")
    families: Mapped[List["Family"]] = relationship("Family", back_populates="tree", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class Association(Base):
    """Произвольная связь между двумя людьми (GEDCOM ASSO)."""
    __tablename__ = "associations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[AssociationType] = mapped_column(String(20), nullable=False, index=True)
    from_id: Mapped[int] = mapped_column(Integer, ForeignKey("individuals.id", ondelete="CASCADE"), nullable=False, index=True)
    to_id: Mapped[int] = mapped_column(Integer, ForeignKey("individuals.id", ondelete="CASCADE"), nullable=False, index=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# Индивиды (люди) — GEDCOM INDI
class Individual(Base):
    __tablename__ = "individuals"
    __table_args__ = (
        UniqueConstraint("tree_id", "gedcom_xref", name="uq_individual_tree_xref"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    gedcom_xref: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "@I1@"

    # Имена
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)   # GIVN
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)    # SURN
    patronymic: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    maiden_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nicknames: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)    # NICK
    aliases: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    gender: Mapped[Gender] = mapped_column(String(1), default=Gender.UNKNOWN, nullable=False)

    is_alive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    biography: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Денормализованные даты/места для быстрого показа (источник истины — события)
    birth_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    birth_place: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    death_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    death_place: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Мягкое удаление
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    tree: Mapped["Tree"] = relationship("Tree", back_populates="individuals")
    events: Mapped[List["Event"]] = relationship("Event", back_populates="individual", cascade="all, delete-orphan")

    # Семьи, где этот человек — супруг/партнёр
    families_as_spouse1: Mapped[List["Family"]] = relationship(
        "Family",
        foreign_keys="Family.spouse1_id",
        back_populates="spouse1",
    )
    families_as_spouse2: Mapped[List["Family"]] = relationship(
        "Family",
        foreign_keys="Family.spouse2_id",
        back_populates="spouse2",
    )

    # Семьи, где этот человек — ребёнок
    family_links_as_child: Mapped[List["FamilyChild"]] = relationship(
        "FamilyChild",
        foreign_keys="FamilyChild.child_id",
        back_populates="child",
        cascade="all, delete-orphan",
    )



# Семьи — GEDCOM FAM


class Family(Base):
    """
    Семья = брачный союз (GEDCOM FAM).
    Хранит пару супругов и общих детей. Нейтральное поле spouse1/spouse2,
    при экспорте в GEDCOM мапится в HUSB/WIFE по полу.
    """
    __tablename__ = "families"
    __table_args__ = (
        UniqueConstraint("tree_id", "gedcom_xref", name="uq_family_tree_xref"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    gedcom_xref: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "@F1@"

    spouse1_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("individuals.id", ondelete="SET NULL"), nullable=True)
    spouse2_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("individuals.id", ondelete="SET NULL"), nullable=True)

    status: Mapped[FamilyStatus] = mapped_column(String(20), default=FamilyStatus.MARRIED, nullable=False)

    # Денормализованные данные о браке (источник истины — событие MARR/DIV)
    marriage_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    marriage_place: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    divorce_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    tree: Mapped["Tree"] = relationship("Tree", back_populates="families")
    spouse1: Mapped[Optional["Individual"]] = relationship(
        "Individual", foreign_keys=[spouse1_id], back_populates="families_as_spouse1"
    )
    spouse2: Mapped[Optional["Individual"]] = relationship(
        "Individual", foreign_keys=[spouse2_id], back_populates="families_as_spouse2"
    )

    children_links: Mapped[List["FamilyChild"]] = relationship(
        "FamilyChild",
        back_populates="family",
        cascade="all, delete-orphan",
    )
    events: Mapped[List["Event"]] = relationship("Event", back_populates="family", cascade="all, delete-orphan")


class FamilyChild(Base):
    """
    Связь ребёнка с семьёй (GEDCOM FAM/CHIL).
    Тип связи — родной / приёмный / опекаемый / пасынок.
    """
    __tablename__ = "family_children"

    family_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("families.id", ondelete="CASCADE"), primary_key=True
    )
    child_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("individuals.id", ondelete="CASCADE"), primary_key=True
    )
    relationship_type: Mapped[ChildRelationType] = mapped_column(
        String(20), default=ChildRelationType.BIOLOGICAL, nullable=False
    )

    family: Mapped["Family"] = relationship("Family", back_populates="children_links")
    child: Mapped["Individual"] = relationship("Individual", back_populates="family_links_as_child")



# События, места, источники


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    longitude: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    events: Mapped[List["Event"]] = relationship("Event", back_populates="place")


class Event(Base):
    """
    Событие — привязано к индивидуальному человеку ИЛИ к семье
    (например, брак — событие семьи, а не отдельной персоны).
    """
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    individual_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("individuals.id", ondelete="CASCADE"), nullable=True, index=True
    )
    family_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("families.id", ondelete="CASCADE"), nullable=True, index=True
    )

    event_type: Mapped[EventType] = mapped_column(String(20), nullable=False, index=True)
    date_str: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # "15 MAR 1900", "около 1895"
    place_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("places.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    individual: Mapped[Optional["Individual"]] = relationship("Individual", back_populates="events")
    family: Mapped[Optional["Family"]] = relationship("Family", back_populates="events")
    place: Mapped[Optional["Place"]] = relationship("Place", back_populates="events")
    citations: Mapped[List["Citation"]] = relationship("Citation", back_populates="event", cascade="all, delete-orphan")


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    publication: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Citation(Base):
    __tablename__ = "citations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    page: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    confidence: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # high/medium/low

    event: Mapped["Event"] = relationship("Event", back_populates="citations")


class Media(Base):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    caption: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    individual_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("individuals.id", ondelete="SET NULL"), nullable=True)
    event_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True)


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tree_id: Mapped[int] = mapped_column(Integer, ForeignKey("trees.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    individual_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("individuals.id", ondelete="CASCADE"), nullable=True)
    family_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("families.id", ondelete="CASCADE"), nullable=True)
    event_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=True)