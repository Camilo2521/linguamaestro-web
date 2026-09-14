import type { LanguageCode, LanguageConfig } from '../types.js';

export const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'Inglés',
    nativeName: 'English',
    flag: '🇬🇧',
    script: 'latin',
    hasTones: false,
    hasKanji: false,
    fontClass: 'font-body',
    description: 'El idioma global del negocio, la ciencia y la cultura pop.',
  },
  fr: {
    code: 'fr',
    name: 'Francés',
    nativeName: 'Français',
    flag: '🇫🇷',
    script: 'latin',
    hasTones: false,
    hasKanji: false,
    fontClass: 'font-body',
    description: 'La lengua del amor, la diplomacia y la haute cuisine.',
  },
  pt: {
    code: 'pt',
    name: 'Portugués',
    nativeName: 'Português',
    flag: '🇧🇷',
    script: 'latin',
    hasTones: false,
    hasKanji: false,
    fontClass: 'font-body',
    description: 'El idioma de Brasil y de 9 países en 4 continentes.',
  },
  es: {
    code: 'es',
    name: 'Español',
    nativeName: 'Español',
    flag: '🇪🇸',
    script: 'latin',
    hasTones: false,
    hasKanji: false,
    fontClass: 'font-body',
    description: 'El segundo idioma más hablado del mundo, 500M de hablantes.',
  },
  ja: {
    code: 'ja',
    name: 'Japonés',
    nativeName: '日本語',
    flag: '🇯🇵',
    script: 'kana',
    hasTones: false,
    hasKanji: true,
    fontClass: 'font-jp',
    description: 'Hiragana, katakana y kanji — un reto de escritura único.',
  },
  zh: {
    code: 'zh',
    name: 'Mandarín',
    nativeName: '普通话',
    flag: '🇨🇳',
    script: 'cjk',
    hasTones: true,
    hasKanji: false,
    fontClass: 'font-cjk',
    description: 'El idioma más hablado del mundo. 4 tonos que cambian el significado.',
  },
};

export const LANGUAGE_LIST = Object.values(LANGUAGES);

export function getLanguage(code: LanguageCode): LanguageConfig {
  return LANGUAGES[code];
}

export const TONE_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F59E0B',
  3: '#10B981',
  4: '#3B82F6',
  0: '#6B7280',
};
