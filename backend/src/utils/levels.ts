import type { CEFRLevel, LevelsConfig } from '../types.js';

export const LEVELS: LevelsConfig = {
  A1: {
    label: 'Principiante',
    min_months: 3,
    min_hours: 90,
    daily_hours_required: 1,
    vocabulary_target: 500,
    next_level: 'A2',
    color: '#06B6D4',
    description: 'Expresiones cotidianas básicas y frases muy sencillas.',
  },
  A2: {
    label: 'Básico',
    min_months: 4,
    min_hours: 180,
    daily_hours_required: 1.5,
    vocabulary_target: 1200,
    next_level: 'B1',
    color: '#3B82F6',
    description: 'Comunicación en situaciones cotidianas frecuentes.',
  },
  B1: {
    label: 'Intermedio',
    min_months: 5,
    min_hours: 300,
    daily_hours_required: 2,
    vocabulary_target: 2500,
    next_level: 'B2',
    color: '#8B5CF6',
    description: 'Textos claros sobre temas conocidos. Viajes con hablantes nativos.',
  },
  B2: {
    label: 'Intermedio alto',
    min_months: 5,
    min_hours: 400,
    daily_hours_required: 2.5,
    vocabulary_target: 4000,
    next_level: 'C1',
    color: '#A855F7',
    description: 'Textos complejos. Interacción fluida con nativos.',
  },
  C1: {
    label: 'Avanzado',
    min_months: 6,
    min_hours: 540,
    daily_hours_required: 3,
    vocabulary_target: 8000,
    next_level: 'C2',
    color: '#EC4899',
    description: 'Textos complejos. Uso espontáneo y efectivo.',
  },
  C2: {
    label: 'Maestría',
    min_months: 6,
    min_hours: 540,
    daily_hours_required: 3,
    vocabulary_target: 16000,
    next_level: 'NATIVE',
    color: '#EF4444',
    description: 'Comprensión de prácticamente todo. Expresión espontánea y precisa.',
  },
  NATIVE: {
    label: 'Nivel nativo',
    min_months: 0,
    min_hours: 0,
    daily_hours_required: 3,
    vocabulary_target: 30000,
    next_level: null,
    color: '#F5A623',
    description: 'Dominio completo equivalente al hablante nativo culto.',
  },
};

export const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE'];

export function getLevelIndex(level: CEFRLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export function getLevelColor(level: CEFRLevel): string {
  return LEVELS[level]?.color ?? '#64748B';
}

export function getNextLevel(level: CEFRLevel): CEFRLevel | null {
  return LEVELS[level]?.next_level ?? null;
}

export function getLevelColorClass(level: CEFRLevel): string {
  return `text-level-${level.toLowerCase()}`;
}
