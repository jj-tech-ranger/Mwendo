import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-label-bold tracking-wide uppercase transition-colors duration-moderate ease-standard';

  const variants = {
    success: 'bg-secondary-container text-on-secondary-container',
    warning: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    danger: 'bg-error-container text-on-error-container',
    info: 'bg-primary-fixed text-on-primary-fixed-variant',
    neutral: 'bg-surface-container-high text-on-surface-variant',
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </span>
  );
};
