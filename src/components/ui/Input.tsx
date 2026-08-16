import React, { useId } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  error?: string | undefined;
  icon?: string | undefined;
  helperText?: string | undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, helperText, className, id, 'aria-describedby': ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || (label ? generatedId : undefined);
    const errorId = `${inputId || generatedId}-error`;

    const computedDescribedBy = [
      error ? errorId : undefined,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-xl pointer-events-none">
              {icon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={computedDescribedBy}
            className={cn(
              'w-full h-12 bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 text-sm font-body-md text-on-surface placeholder:text-outline transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50',
              icon && 'pl-11',
              error && 'border-error focus:border-error focus:ring-error',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs font-body-sm text-error">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-xs font-body-sm text-on-surface-variant">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
