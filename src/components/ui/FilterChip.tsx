import React from 'react';
import { cn } from '../../lib/utils';

export interface FilterChipProps {
  label: string;
  isActive?: boolean | undefined;
  count?: number | undefined;
  icon?: string | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  isActive = false,
  count,
  icon,
  onClick,
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label-bold transition-all duration-200 select-none cursor-pointer whitespace-nowrap border',
        isActive
          ? 'bg-primary-container text-on-primary border-primary shadow-xs'
          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container hover:text-on-surface',
        className
      )}
    >
      {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'px-1.5 py-0.2 rounded-full text-[10px] font-label-mono font-bold',
            isActive
              ? 'bg-on-primary/20 text-on-primary'
              : 'bg-surface-container-high text-on-surface-variant'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
};

export interface FilterGroupProps {
  options: { key: string; label: string; count?: number; icon?: string }[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export const FilterGroup: React.FC<FilterGroupProps> = ({
  options,
  activeKey,
  onChange,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar', className)}>
      {options.map((opt) => (
        <FilterChip
          key={opt.key}
          label={opt.label}
          count={opt.count}
          icon={opt.icon}
          isActive={activeKey === opt.key}
          onClick={() => onChange(opt.key)}
        />
      ))}
    </div>
  );
};
