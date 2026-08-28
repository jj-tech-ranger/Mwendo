import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ('primary' | 'secondary' | 'outline' | 'ghost' | 'danger') | undefined;
  size?: ('sm' | 'md' | 'lg') | undefined;
  isLoading?: boolean | undefined;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-label-bold rounded-full transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

  const variants = {
    primary: 'bg-primary-container text-on-primary hover:bg-primary shadow-sm',
    secondary: 'bg-secondary-container text-on-secondary-container hover:bg-secondary/20',
    outline: 'border border-outline-variant text-on-surface hover:bg-surface-container',
    ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
    danger: 'bg-error text-on-error hover:bg-error/90 shadow-sm',
  };

  const sizes = {
    sm: 'h-9 px-4 text-xs',
    md: 'h-12 px-6 text-sm',
    lg: 'h-14 px-8 text-base',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
