import { create } from 'zustand';
import i18n from '../services/i18n';

interface LanguageState {
  language: 'en' | 'sw';
  setLanguage: (lang: 'en' | 'sw') => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    set({ language: lang });
  },
  toggleLanguage: () =>
    set((state) => {
      const nextLang = state.language === 'en' ? 'sw' : 'en';
      i18n.changeLanguage(nextLang);
      return { language: nextLang };
    }),
}));
