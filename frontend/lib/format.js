export const fullName = (p) =>
  [p?.first_name, p?.patronymic, p?.last_name].filter(Boolean).join(' ');

export const shortName = (p) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(' ');