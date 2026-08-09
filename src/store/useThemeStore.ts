import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeVariant = 'default' | 'authority' | 'admin';

interface ThemeState {
  mode: ThemeMode;
  variant: ThemeVariant;
  setMode: (mode: ThemeMode) => void;
  setVariant: (variant: ThemeVariant) => void;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  variant: 'default',
  setMode: (mode) => {
    document.documentElement.classList.remove('dark', 'light');
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
    set({ mode });
  },
  setVariant: (variant) => {
    document.documentElement.classList.remove('theme-authority', 'theme-admin');
    if (variant === 'authority') {
      document.documentElement.classList.add('theme-authority');
    } else if (variant === 'admin') {
      document.documentElement.classList.add('theme-admin');
    }
    set({ variant });
  },
  toggleDarkMode: () =>
    set((state) => {
      const newMode = state.mode === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(newMode);
      return { mode: newMode };
    }),
}));
