import React from 'react';
import { cn } from '../../lib/utils';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, className, placeholder = 'Search...', ...props }, ref) => {
    const hasValue = Boolean(value);

    return (
      <div className="relative w-full flex items-center">
        <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-xl pointer-events-none">
          search
        </span>
        <input
          ref={ref}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-label={props['aria-label'] || placeholder}
          className={cn(
            'w-full h-11 bg-surface-container-low border border-outline-variant/40 rounded-full pl-11 pr-10 text-sm font-body-md text-on-surface placeholder:text-outline transition-all focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
            className
          )}
          {...props}
        />
        {hasValue && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-3 p-1 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-lg">cancel</span>
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
