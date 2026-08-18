import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '../locales/en';
import { sw } from '../locales/sw';

// Read pre-saved language synchronously to prevent hydration mismatches
const getSavedLanguage = (): 'en' | 'sw' => {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('mwendo-language');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.language === 'sw' || parsed?.state?.language === 'en') {
          return parsed.state.language;
        }
      }
    } catch (e) {
      console.warn('[i18n] Error reading stored language:', e);
    }
  }
  return 'en';
};

const initialLang = getSavedLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sw: { translation: sw },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // react handles escaping
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
  i18n.on('languageChanged', (lng) => {
    if (document.documentElement) {
      document.documentElement.lang = lng;
    }
  });
}

export default i18n;

