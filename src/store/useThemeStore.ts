import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeVariant = 'default' | 'authority' | 'admin';

interface ThemeState {
  mode: ThemeMode;
  variant: ThemeVariant;
  setMode: (mode: ThemeMode, syncToFirestore?: boolean) => void;
  setVariant: (variant: ThemeVariant) => void;
  toggleDarkMode: () => void;
}

const applyThemeClasses = (mode: ThemeMode, variant?: ThemeVariant) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('dark', 'light');
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.add('light');
  }

  if (variant) {
    document.documentElement.classList.remove('theme-authority', 'theme-admin');
    if (variant === 'authority') {
      document.documentElement.classList.add('theme-authority');
    } else if (variant === 'admin') {
      document.documentElement.classList.add('theme-admin');
    }
  }
};

const syncThemeToFirestore = async (mode: ThemeMode) => {
  try {
    const user = auth?.currentUser;
    if (user && !user.isAnonymous && db) {
      await updateDoc(doc(db, 'users', user.uid), {
        theme: mode,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[useThemeStore] Firestore sync error:', err);
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      variant: 'default',
      setMode: (mode, syncToFirestore = true) => {
        applyThemeClasses(mode, get().variant);
        set({ mode });
        if (syncToFirestore) {
          syncThemeToFirestore(mode);
        }
      },
      setVariant: (variant) => {
        applyThemeClasses(get().mode, variant);
        set({ variant });
      },
      toggleDarkMode: () => {
        const newMode = get().mode === 'dark' ? 'light' : 'dark';
        get().setMode(newMode);
      },
    }),
    {
      name: 'mwendo-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeClasses(state.mode, state.variant);
        }
      },
    }
  )
);

