"""
Импорт GEDCOM 5.5.1 в БД.
"""
import re
from datetime import date as date_cls
from typing import Optional

from ged4py import GedcomReader

from models import (
    ChildRelationType,
    Family,
    FamilyChild,
    FamilyStatus,
    Gender,
    Individual,
)


GENDER_MAP = {
    "M": Gender.MALE,
    "F": Gender.FEMALE,
    "U": Gender.UNKNOWN,
}

MONTHS_RU = {
    1: "января", 2: "февраля", 3: "марта", 4: "апреля",
    5: "мая", 6: "июня", 7: "июля", 8: "августа",
    9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
}

MONTHS_EN = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4,
    "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8,
    "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}


# ---------------------------------------------------------------------------
# Даты
# ---------------------------------------------------------------------------

def _format_date_ru(date_value) -> Optional[str]:
    """
    Превращает DateValue (или строку) в '3 июня 1930'.
    Если не удаётся распарсить — возвращает исходную строку как есть.
    """
    if date_value is None:
        return None

    # 1. Уже datetime.date — самый надёжный путь
    if isinstance(date_value, date_cls):
        return f"{date_value.day} {MONTHS_RU[date_value.month]} {date_value.year}"

    # 2. Строка — пробуем распарсить напрямую
    if isinstance(date_value, str):
        return _parse_gedcom_date_ru(date_value)

    # 3. Методы-строки (в разных версиях ged4py)
    for attr in ("date_string", "pretty", "date_str"):
        val = getattr(date_value, attr, None)
        if callable(val):
            try:
                val = val()
            except Exception:
                val = None
        if isinstance(val, str) and val.strip():
            return _parse_gedcom_date_ru(val)

    # 4. Атрибут .date (может быть datetime.date или Date-объект)
    raw = getattr(date_value, "date", None)
    if raw is not None:
        if isinstance(raw, date_cls):
            return f"{raw.day} {MONTHS_RU[raw.month]} {raw.year}"
        inner = getattr(raw, "date", None)
        if isinstance(inner, date_cls):
            return f"{inner.day} {MONTHS_RU[inner.month]} {inner.year}"

    # 5. Fallback: str(DateValue) → "DateValue(1930 JUN 3)"
    s = str(date_value).strip()
    m = re.match(r"^DateValue\((.+)\)$", s)
    if m:
        return _parse_gedcom_date_ru(m.group(1))
    return _parse_gedcom_date_ru(s)


def _parse_gedcom_date_ru(s: str) -> Optional[str]:
    """'1930 JUN 3' / '3 JUN 1930' / 'JUN 1930' / '1930' / 'ABT 1900' → на русском, где возможно."""
    if not s:
        return None
    s = s.strip()
    if not s:
        return None

    # "ABT 1900", "BEF 1914", "AFT 1890" и прочие модификаторы — оставляем как есть
    modifier_match = re.match(r"^(ABT|BEF|AFT|EST|CAL)\s+(.+)$", s, re.IGNORECASE)
    if modifier_match:
        prefix = modifier_match.group(1).upper()
        rest = _parse_gedcom_date_ru(modifier_match.group(2))
        return f"{prefix} {rest}"

    # "DD MMM YYYY" или "YYYY MMM DD"
    m = re.match(r"^(\d{1,2})\s+([A-Z]{3,})\s+(\d{4})$", s, re.IGNORECASE)
    if m:
        day, mon, year = int(m.group(1)), m.group(2).upper()[:3], m.group(3)
        if mon in MONTHS_EN:
            return f"{day} {MONTHS_RU[MONTHS_EN[mon]]} {year}"

    m = re.match(r"^(\d{4})\s+([A-Z]{3,})\s+(\d{1,2})$", s, re.IGNORECASE)
    if m:
        year, mon, day = m.group(1), m.group(2).upper()[:3], int(m.group(3))
        if mon in MONTHS_EN:
            return f"{day} {MONTHS_RU[MONTHS_EN[mon]]} {year}"

    # "MMM YYYY"
    m = re.match(r"^([A-Z]{3,})\s+(\d{4})$", s, re.IGNORECASE)
    if m:
        mon, year = m.group(1).upper()[:3], m.group(2)
        if mon in MONTHS_EN:
            return f"{MONTHS_RU[MONTHS_EN[mon]].capitalize()} {year}"

    # "YYYY MMM"
    m = re.match(r"^(\d{4})\s+([A-Z]{3,})$", s, re.IGNORECASE)
    if m:
        year, mon = m.group(1), m.group(2).upper()[:3]
        if mon in MONTHS_EN:
            return f"{MONTHS_RU[MONTHS_EN[mon]].capitalize()} {year}"

    # "DD.MM.YYYY"
    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", s)
    if m:
        day, mon, year = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= mon <= 12:
            return f"{day} {MONTHS_RU[mon]} {year}"

    # Просто год
    if re.match(r"^\d{4}$", s):
        return s

    # Не распознали — оставляем как есть
    return s


# ---------------------------------------------------------------------------
# Безопасное извлечение значений
# ---------------------------------------------------------------------------

def _value_of(record) -> Optional[str]:
    """Достаёт .value (str/tuple/DateValue) и приводит к строке."""
    if record is None:
        return None
    v = record.value
    if v is None:
        return None
    if isinstance(v, str):
        return v.strip() or None
    if isinstance(v, tuple):
        parts = [str(x).strip() for x in v if x]
        return " ".join(parts).strip() or None
    # DateValue и прочее — не пытаемся угадать, отдаём как есть
    try:
        s = str(v).strip()
        return s or None
    except Exception:
        return None


def _sub_value(record, tag: str) -> Optional[str]:
    if record is None or not tag:
        return None
    return _value_of(record.sub_tag(tag))


def _path_value(record, path: str) -> Optional[str]:
    if record is None or not path:
        return None
    current = record
    for part in path.split("/"):
        if current is None:
            return None
        current = current.sub_tag(part)
    return _value_of(current)


def _pointer_xref(record, tag: str) -> Optional[str]:
    if record is None or not tag:
        return None
    sub = record.sub_tag(tag)
    if sub is None:
        return None
    xref = getattr(sub, "xref_id", None)
    if xref:
        return str(xref)
    v = sub.value
    if isinstance(v, str) and v.startswith("@") and v.endswith("@"):
        return v
    return None


def _pointer_list(record, tag: str) -> list[str]:
    result = []
    if record is None or not tag:
        return result
    for sub in record.sub_tags(tag):
        xref = getattr(sub, "xref_id", None)
        if xref:
            result.append(str(xref))
        else:
            v = sub.value
            if isinstance(v, str) and v.startswith("@") and v.endswith("@"):
                result.append(v)
    return result


# ---------------------------------------------------------------------------
# Извлечение полей
# ---------------------------------------------------------------------------

def _extract_name_parts(record) -> tuple[Optional[str], Optional[str], Optional[str]]:
    given = _path_value(record, "NAME/GIVN")
    sur = _path_value(record, "NAME/SURN")

    if not given and not sur:
        name_rec = record.sub_tag("NAME")
        if name_rec:
            v = name_rec.value
            if isinstance(v, tuple):
                if len(v) > 0 and v[0]:
                    given = str(v[0]).strip() or None
                if len(v) > 1 and v[1]:
                    sur = str(v[1]).strip() or None
            elif isinstance(v, str):
                parts = v.split("/")
                if len(parts) >= 2:
                    given = parts[0].strip() or None
                    sur = parts[1].strip() or None
                else:
                    given = v.strip() or None

    nick = _sub_value(record, "NICK")
    return given, sur, nick


def _extract_event(record, tag: str) -> tuple[Optional[str], Optional[str]]:
    """Возвращает (date_ru, place) для BIRT/DEAT/MARR/DIV."""
    event = record.sub_tag(tag)
    if event is None:
        return None, None

    date_rec = event.sub_tag("DATE")
    place_rec = event.sub_tag("PLAC")

    date_str = _format_date_ru(date_rec.value) if date_rec is not None else None
    place = _value_of(place_rec)
    return date_str, place


def _extract_sex(record) -> Gender:
    sex = _sub_value(record, "SEX")
    if not sex:
        return Gender.UNKNOWN
    return GENDER_MAP.get(sex.upper(), Gender.UNKNOWN)


# ---------------------------------------------------------------------------
# Импорт
# ---------------------------------------------------------------------------

def import_gedcom(ged_path: str, tree_id: int, db) -> dict:
    xref_to_individual = {}
    individuals_count = 0
    families_count = 0
    child_links_count = 0

    with GedcomReader(ged_path) as parser:
        for rec in parser.records0("INDI"):
            given, sur, nick = _extract_name_parts(rec)
            gender = _extract_sex(rec)
            birth_date, birth_place = _extract_event(rec, "BIRT")
            death_date, death_place = _extract_event(rec, "DEAT")
            is_alive = death_date is None

            ind = Individual(
                tree_id=tree_id,
                gedcom_xref=rec.xref_id,
                first_name=given,
                last_name=sur,
                nicknames=nick,
                gender=gender,
                is_alive=is_alive,
                birth_date=birth_date,
                birth_place=birth_place,
                death_date=death_date,
                death_place=death_place,
            )
            db.add(ind)
            db.flush()
            xref_to_individual[rec.xref_id] = ind
            individuals_count += 1

        for rec in parser.records0("FAM"):
            husb_xref = _pointer_xref(rec, "HUSB")
            wife_xref = _pointer_xref(rec, "WIFE")

            spouse1 = xref_to_individual.get(husb_xref) if husb_xref else None
            spouse2 = xref_to_individual.get(wife_xref) if wife_xref else None

            if spouse1 is None and spouse2 is None:
                continue

            marriage_date, marriage_place = _extract_event(rec, "MARR")
            divorce_date, _ = _extract_event(rec, "DIV")
            status = FamilyStatus.DIVORCED if divorce_date else FamilyStatus.MARRIED

            fam = Family(
                tree_id=tree_id,
                gedcom_xref=rec.xref_id,
                spouse1_id=spouse1.id if spouse1 else None,
                spouse2_id=spouse2.id if spouse2 else None,
                status=status,
                marriage_date=marriage_date,
                marriage_place=marriage_place,
                divorce_date=divorce_date,
            )
            db.add(fam)
            db.flush()
            families_count += 1

            for child_xref in _pointer_list(rec, "CHIL"):
                child = xref_to_individual.get(child_xref)
                if not child:
                    continue
                db.add(
                    FamilyChild(
                        family_id=fam.id,
                        child_id=child.id,
                        relationship_type=ChildRelationType.BIOLOGICAL,
                    )
                )
                child_links_count += 1

    return {
        "individuals": individuals_count,
        "families": families_count,
        "child_links": child_links_count,
    }