"""
Экспорт БД → GEDCOM 5.5.1.
Обратная операция к gedcom_import.py.
"""
import re
from datetime import datetime
from typing import Optional


MONTHS_EN = {
    1: "JAN", 2: "FEB", 3: "MAR", 4: "APR", 5: "MAY", 6: "JUN",
    7: "JUL", 8: "AUG", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DEC",
}

MONTHS_RU = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4,
    "мая": 5, "июня": 6, "июля": 7, "августа": 8,
    "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}


def date_to_gedcom(date_str: Optional[str]) -> Optional[str]:
    """
    Преобразует русскую/свободную дату в GEDCOM-формат.
    '3 июня 1930'  → '3 JUN 1930'
    '11.02.2006'   → '11 FEB 2006'
    '2006-02-11'   → '11 FEB 2006'
    'ABT 1900'     → 'ABT 1900'
    '1930'         → '1930'
    """
    if not date_str:
        return None
    s = str(date_str).strip()
    if not s:
        return None

    # Модификатор
    m = re.match(r"^(ABT|BEF|AFT|EST|CAL|ОК\.?|ДО|ПОСЛЕ)\s+(.+)$", s, re.IGNORECASE)
    if m:
        prefix_raw = m.group(1).upper()
        prefix_map = {"ОК": "ABT", "ОК.": "ABT", "ДО": "BEF", "ПОСЛЕ": "AFT"}
        prefix = prefix_map.get(prefix_raw, prefix_raw)
        rest = date_to_gedcom(m.group(2))
        return f"{prefix} {rest}" if rest else prefix

    # 'DD месяц YYYY'
    m = re.match(r"^(\d{1,2})\s+([а-яА-Я]+)\s+(\d{4})$", s)
    if m:
        day = int(m.group(1))
        mon_num = MONTHS_RU.get(m.group(2).lower())
        year = m.group(3)
        if mon_num:
            return f"{day} {MONTHS_EN[mon_num]} {year}"

    # 'DD.MM.YYYY'
    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", s)
    if m:
        day, mon, year = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= mon <= 12:
            return f"{day} {MONTHS_EN[mon]} {year}"

    # 'YYYY-MM-DD'
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if m:
        year, mon, day = m.group(1), int(m.group(2)), int(m.group(3))
        if 1 <= mon <= 12:
            return f"{day} {MONTHS_EN[mon]} {year}"

    # Просто год
    if re.match(r"^\d{4}$", s):
        return s

    # Fallback: как есть
    return s


def _gender_str(ind) -> str:
    if not ind or not ind.gender:
        return "U"
    g = ind.gender.value if hasattr(ind.gender, "value") else ind.gender
    g = str(g).upper()
    return g if g in ("M", "F") else "U"


def _xref(record, prefix: str) -> str:
    """Возвращает @I1@ / @F1@ — из gedcom_xref или из id."""
    if getattr(record, "gedcom_xref", None):
        return record.gedcom_xref
    return f"@{prefix}{record.id}@"


def _event_type_value(ev) -> str:
    et = ev.event_type
    return et.value if hasattr(et, "value") else str(et)


def export_gedcom(tree, individuals, families, family_children, events) -> str:
    """
    Генерирует GEDCOM 5.5.1 строку.
    """
    lines = []

    # --- HEAD ---
    lines.append("0 HEAD")
    lines.append("1 SOUR GenealogyApp")
    lines.append("2 VERS 1.0")
    lines.append("2 NAME Genealogy App")
    lines.append("1 GEDC")
    lines.append("2 VERS 5.5.1")
    lines.append("2 FORM LINEAGE-LINKED")
    lines.append("1 CHAR UTF-8")
    lines.append("1 DATE " + datetime.utcnow().strftime("%d %b %Y").upper())
    lines.append("1 SUBM @SUBM1@")
    lines.append("0 @SUBM1@ SUBM")
    lines.append("1 NAME GenealogyApp")

    # Карты для быстрого доступа
    individuals_by_id = {i.id: i for i in individuals}
    families_by_id = {f.id: f for f in families}

    # --- Individuals ---
    for ind in individuals:
        xref = _xref(ind, "I")
        lines.append(f"0 {xref} INDI")

        # NAME
        if ind.first_name or ind.last_name:
            name = f"{ind.first_name or ''} /{ind.last_name or ''}/".strip()
            lines.append(f"1 NAME {name}")

        if ind.nicknames:
            lines.append(f"1 NICK {ind.nicknames}")

        gender = _gender_str(ind)
        lines.append(f"1 SEX {gender}")

        # --- события персоны ---
        ind_events = sorted(
            [e for e in events if e.individual_id == ind.id],
            key=lambda x: x.id,
        )

        VALUE_TAGS = {"OCCU", "EDUC", "RELI"}
        DATE_TAGS = {"BIRT", "DEAT", "BURI", "CREM", "BAPM", "MILI", "IMMI", "EMIG", "RESI"}

        for ev in ind_events:
            et = _event_type_value(ev)
            if et in VALUE_TAGS:
                if ev.description:
                    lines.append(f"1 {et} {ev.description}")
                continue
            if et in DATE_TAGS:
                lines.append(f"1 {et}")
                gd = date_to_gedcom(ev.date_str)
                if gd:
                    lines.append(f"2 DATE {gd}")
                if ev.place and ev.place.name:
                    lines.append(f"2 PLAC {ev.place.name}")
                if ev.description:
                    lines.append(f"2 NOTE {ev.description}")

        # --- FAMS: семьи, где индивид — супруг ---
        spous_fams = [
            f for f in families
            if f.spouse1_id == ind.id or f.spouse2_id == ind.id
        ]
        for f in spous_fams:
            lines.append(f"1 FAMS {_xref(f, 'F')}")

        # --- FAMC: семьи, где индивид — ребёнок ---
        famc_links = [fc for fc in family_children if fc.child_id == ind.id]
        for fc in famc_links:
            fam = families_by_id.get(fc.family_id)
            if fam:
                lines.append(f"1 FAMC {_xref(fam, 'F')}")

    # --- Families ---
    for fam in families:
        xref = _xref(fam, "F")
        lines.append(f"0 {xref} FAM")

        sp1 = individuals_by_id.get(fam.spouse1_id) if fam.spouse1_id else None
        sp2 = individuals_by_id.get(fam.spouse2_id) if fam.spouse2_id else None
        g1 = _gender_str(sp1) if sp1 else None
        g2 = _gender_str(sp2) if sp2 else None

        husb, wife = None, None
        if sp1 and sp2:
            if g1 == "M" and g2 == "F":
                husb, wife = sp1, sp2
            elif g1 == "F" and g2 == "M":
                husb, wife = sp2, sp1
            else:
                # Однополые / неизвестные — GEDCOM 5.5.1 строго HUSB/WIFE.
                # Ставим spouse1 как HUSB, spouse2 как WIFE.
                husb, wife = sp1, sp2
        elif sp1:
            if g1 == "F":
                wife = sp1
            else:
                husb = sp1
        elif sp2:
            if g2 == "F":
                wife = sp2
            else:
                husb = sp2

        if husb:
            lines.append(f"1 HUSB {_xref(husb, 'I')}")
        if wife:
            lines.append(f"1 WIFE {_xref(wife, 'I')}")

        # Дети
        for fc in [x for x in family_children if x.family_id == fam.id]:
            child = individuals_by_id.get(fc.child_id)
            if child:
                lines.append(f"1 CHIL {_xref(child, 'I')}")

        # --- события семьи (MARR, DIV, ENGA) ---
        fam_events = sorted(
            [e for e in events if e.family_id == fam.id],
            key=lambda x: x.id,
        )
        for ev in fam_events:
            et = _event_type_value(ev)
            if et in ("MARR", "DIV", "ENGA"):
                lines.append(f"1 {et}")
                gd = date_to_gedcom(ev.date_str)
                if gd:
                    lines.append(f"2 DATE {gd}")
                if ev.place and ev.place.name:
                    lines.append(f"2 PLAC {ev.place.name}")

    lines.append("0 TRLR")
    return "\n".join(lines) + "\n"