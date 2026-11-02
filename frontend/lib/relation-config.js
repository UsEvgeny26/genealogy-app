export const RELATION_TYPES = {
  BIOLOGICAL_PARENT: 'biological_parent',
  ADOPTIVE_PARENT: 'adoptive_parent',
  FOSTER_PARENT: 'foster_parent',
  STEP_PARENT: 'step_parent',
  MARRIAGE: 'marriage',
  GODPARENT: 'godparent',
};

export const RELATION_CONFIG = {
  [RELATION_TYPES.BIOLOGICAL_PARENT]: {
    label: 'Родной родитель',
    color: '#3b82f6',
    dashed: false,
    arrow: true,
    pathType: 'smoothstep',
  },
  [RELATION_TYPES.ADOPTIVE_PARENT]: {
    label: 'Приёмный родитель',
    color: '#a855f7',
    dashed: true,
    arrow: true,
    pathType: 'smoothstep',
  },
  [RELATION_TYPES.FOSTER_PARENT]: {
    label: 'Опекун',
    color: '#14b8a6',
    dashed: true,
    arrow: true,
    pathType: 'smoothstep',
  },
  [RELATION_TYPES.STEP_PARENT]: {
    label: 'Отчим / Мачеха',
    color: '#f59e0b',
    dashed: true,
    arrow: true,
    pathType: 'smoothstep',
  },
  [RELATION_TYPES.MARRIAGE]: {
    label: 'Супруг(а)',
    color: '#ec4899',
    dashed: true,
    arrow: false,
    pathType: 'straight',
  },
  [RELATION_TYPES.GODPARENT]: {
    label: 'Крёстный',
    color: '#f59e0b',
    dashed: true,
    arrow: true,
    pathType: 'smoothstep',
  },
};

export const DIVORCED_COLOR = '#9ca3af';