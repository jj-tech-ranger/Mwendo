import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../services/i18n';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface LanguageState {
  language: 'en' | 'sw';
  setLanguage: (lang: 'en' | 'sw', syncToFirestore?: boolean) => void;
  toggleLanguage: () => void;
}

const syncLanguageToFirestore = async (lang: 'en' | 'sw') => {
  try {
    const user = auth?.currentUser;
    if (user && !user.isAnonymous && db) {
      await updateDoc(doc(db, 'users', user.uid), {
        language: lang,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[useLanguageStore] Firestore sync error:', err);
  }
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'en',
      setLanguage: (lang, syncToFirestore = true) => {
        i18n.changeLanguage(lang);
        if (typeof document !== 'undefined') {
          document.documentElement.lang = lang;
        }
        set({ language: lang });
        if (syncToFirestore) {
          syncLanguageToFirestore(lang);
        }
      },
      toggleLanguage: () => {
        const nextLang = get().language === 'en' ? 'sw' : 'en';
        get().setLanguage(nextLang);
      },
    }),
    {
      name: 'mwendo-language',
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          i18n.changeLanguage(state.language);
          if (typeof document !== 'undefined') {
            document.documentElement.lang = state.language;
          }
        }
      },
    }
  )
);

