import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '../locales/en';
import { sw } from '../locales/sw';
import { welcomeEn, welcomeSw } from '../locales/welcome';

// Read pre-saved language synchronously to prevent hydration mismatches.
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
    } catch (error) {
      console.warn('[i18n] Error reading stored language:', error);
    }
  }

  return 'en';
};

const initialLang = getSavedLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, welcome: { ...en.welcome, ...welcomeEn } } },
    sw: { translation: { ...sw, welcome: { ...sw.welcome, ...welcomeSw } } },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React handles escaping.
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
