export const fullName = (p) =>
  [p?.first_name, p?.patronymic, p?.last_name].filter(Boolean).join(' ');

export const shortName = (p) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ');

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MONTHS_EN = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Приводит любую дату к формату «11 февраля 2006».
 * Понимает:
 *   - 11.02.2006, 11/02/2006, 2006-02-11, 2006/02/11
 *   - 2006 FEB 11, 11 FEB 2006, FEB 2006, 2006 FEB
 *   - «ABT 1900» / «BEF 1914» / «ОК. 1895» — сохраняет префикс
 *   - Уже русский «11 февраля 2006» — оставляет как есть
 *   - Просто год «1945» — оставляет как есть
 */
export function formatDateRu(input) {
  if (input == null) return input;
  const s = String(input).trim();
  if (!s) return s;

  // Префиксы неопределённости — сохраняем, форматируем остаток
  const mMod = s.match(/^(ABT|BEF|AFT|EST|CAL|ОК\.?|ДО|ПОСЛЕ)\s+(.+)$/i);
  if (mMod) {
    return `${mMod[1]} ${formatDateRu(mMod[2])}`;
  }

  // DD.MM.YYYY
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    const year = m[3];
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return `${day} ${MONTHS_RU[mon - 1]} ${year}`;
    }
  }

  // YYYY-MM-DD (ISO)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = m[1];
    const mon = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (mon >= 1 && mon <= 12) {
      return `${day} ${MONTHS_RU[mon - 1]} ${year}`;
    }
  }

  // YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const year = m[1];
    const mon = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (mon >= 1 && mon <= 12) {
      return `${day} ${MONTHS_RU[mon - 1]} ${year}`;
    }
  }

  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    const year = m[3];
    if (mon >= 1 && mon <= 12) {
      return `${day} ${MONTHS_RU[mon - 1]} ${year}`;
    }
  }

  // DD MMM YYYY (11 FEB 2006)
  m = s.match(/^(\d{1,2})\s+([A-Z]{3,})\s+(\d{4})$/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = MONTHS_EN[m[2].toUpperCase().slice(0, 3)];
    const year = m[3];
    if (mon) return `${day} ${MONTHS_RU[mon - 1]} ${year}`;
  }

  // YYYY MMM DD (2006 FEB 11)
  m = s.match(/^(\d{4})\s+([A-Z]{3,})\s+(\d{1,2})$/i);
  if (m) {
    const year = m[1];
    const mon = MONTHS_EN[m[2].toUpperCase().slice(0, 3)];
    const day = parseInt(m[3], 10);
    if (mon) return `${day} ${MONTHS_RU[mon - 1]} ${year}`;
  }

  // MMM YYYY (FEB 2006)
  m = s.match(/^([A-Z]{3,})\s+(\d{4})$/i);
  if (m) {
    const mon = MONTHS_EN[m[1].toUpperCase().slice(0, 3)];
    const year = m[2];
    if (mon) return `${capitalize(MONTHS_RU[mon - 1])} ${year}`;
  }

  // YYYY MMM (2006 FEB)
  m = s.match(/^(\d{4})\s+([A-Z]{3,})$/i);
  if (m) {
    const year = m[1];
    const mon = MONTHS_EN[m[2].toUpperCase().slice(0, 3)];
    if (mon) return `${capitalize(MONTHS_RU[mon - 1])} ${year}`;
  }

  // Уже в нужном виде (11 февраля 2006) или просто год — не трогаем
  return s;
}