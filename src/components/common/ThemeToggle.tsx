import React from 'react';
import { useThemeStore } from '../../store/useThemeStore';

export const ThemeToggle: React.FC = () => {
  const mode = useThemeStore((s) => s.mode);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer"
      title="Toggle Dark Mode"
    >
      <span className="material-symbols-outlined text-xl">
        {mode === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
};
