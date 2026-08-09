import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'elevated' | 'outline';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  ...props
}) => {
  const baseStyles = 'rounded-xl p-md sm:p-lg transition-all duration-200';

  const variants = {
    default: 'bg-surface-container-lowest border border-outline-variant/30 shadow-sm',
    flat: 'bg-surface-container border border-outline-variant/20',
    elevated: 'bg-surface-container-lowest shadow-md border border-outline-variant/20',
    outline: 'bg-transparent border border-outline-variant',
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </div>
  );
};
