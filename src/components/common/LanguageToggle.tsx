import React from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';

export const LanguageToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  return (
    <div
      role="group"
      aria-label="Language selector"
      className={`inline-flex items-center p-0.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-label-mono ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
          language === 'en'
            ? 'bg-primary text-on-primary shadow-xs'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
        }`}
        title="English"
        aria-pressed={language === 'en'}
      >
        <span>EN</span>
        <span className="text-[10px] opacity-90 hidden sm:inline">English</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage('sw')}
        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
          language === 'sw'
            ? 'bg-primary text-on-primary shadow-xs'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
        }`}
        title="Kiswahili"
        aria-pressed={language === 'sw'}
      >
        <span>SW</span>
        <span className="text-[10px] opacity-90 hidden sm:inline">Kiswahili</span>
      </button>
    </div>
  );
};

