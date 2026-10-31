from datetime import datetime
from enum import Enum
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
    func,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# Включаем каскадные внешние ключи для SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class ParentChild(Base):
    """Таблица связей Родитель-Ребёнок (родные и приёмные)."""

    __tablename__ = "parent_child"

    parent_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("persons.id", ondelete="CASCADE"),
        primary_key=True,
    )
    child_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("persons.id", ondelete="CASCADE"),
        primary_key=True,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="biological")


class Person(Base):
    """Расширенная карточка человека"""

    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # 1. Персональные данные и имена
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    given_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Имя при рождении
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    patronymic: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Отчество
    maiden_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Девичья фамилия
    aliases: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Псевдонимы / прозвища
    gender: Mapped[Gender] = mapped_column(SQLEnum(Gender), default=Gender.UNKNOWN, nullable=False)
    is_alive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # Состояние: жив / умер
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # 2. Ключевые жизненные события (с поддержкой текстовых/неточных дат)
    birth_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # «около 1895», «до 1914»
    birth_place: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Поля при статусе умер (is_alive == False)
    death_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    death_place: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    death_cause: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Погребение / Кремация
    cemetery_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cemetery_plot: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cemetery_gps: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Эмиграция / Переезд
    immigration_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    immigration_port: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    immigration_doc: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # 4. Социальный статус, карьера и образование
    occupations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Профессия с периодом
    education: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Образование
    social_status: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Сословие

    # Военная служба
    military_is_served: Mapped[Optional[bool]] = mapped_column(Boolean, default=False, nullable=True)
    military_regiment: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Полк / часть
    military_rank: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Звание / чин
    military_battles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Войны / сражения
    military_awards: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Награды и ордена

    religion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Вероисповедание
    residences: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Места проживания с датами

    # 5. Биография
    biography: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Связи родитель-ребенок
    parents: Mapped[List["Person"]] = relationship(
        "Person",
        secondary="parent_child",
        primaryjoin="Person.id == ParentChild.child_id",
        secondaryjoin="Person.id == ParentChild.parent_id",
        backref="children",
    )


class Marriage(Base):
    """Связь «супруги». Отдельная сущность, потому что у брака есть свои атрибуты."""

    __tablename__ = "marriages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    spouse1_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    spouse2_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    end_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # "married" | "divorced" | "widowed" | "partners" — на будущее
    status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class Relation(Base):
    """Универсальная таблица прочих связей (не родитель-ребёнок, не брак).

    type:
      - 'adoptive_parent': from_id — приёмный родитель, to_id — приёмный ребёнок
      - 'godparent':       from_id — крёстный,          to_id — крестник/крестница
    На будущее: 'guardian', 'mentor', 'foster_parent' — без миграций.
    """

    __tablename__ = "relations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    from_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)



class User(Base):
    """Пользователь (пока не используется в бизнес-логике)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())