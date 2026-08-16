import React from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';

export const LanguageToggle: React.FC = () => {
  const language = useLanguageStore((s) => s.language);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  return (
    <button
      onClick={toggleLanguage}
      className="px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-label-mono text-xs uppercase tracking-wider hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer"
      title="Switch Language"
    >
      <span className="material-symbols-outlined text-base">language</span>
      <span>{language === 'en' ? 'SW' : 'EN'}</span>
    </button>
  );
};
