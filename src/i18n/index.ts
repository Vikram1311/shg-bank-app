import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import hi from './hi.json';
import en from './en.json';
import ta from './ta.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      hi: { translation: hi },
      en: { translation: en },
      ta: { translation: ta },
    },
    fallbackLng: 'hi',
    interpolation: { escapeValue: false },
  });

export default i18n;
