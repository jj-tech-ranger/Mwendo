import React from 'react';
import { motion } from 'motion/react';
import type { MotionStyle } from 'motion/react';
import { cn } from '../../lib/utils';
import { usePressableMotionProps } from '../../lib/motion';

type NativeButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'style' | 'onDrag' | 'onDragStart' | 'onDragEnd'
>;

interface ButtonProps extends NativeButtonProps {
  variant?: ('primary' | 'secondary' | 'outline' | 'ghost' | 'danger') | undefined;
  size?: ('sm' | 'md' | 'lg') | undefined;
  isLoading?: boolean | undefined;
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  style,
  ...props
}) => {
  const pressableProps = usePressableMotionProps();
  const baseStyles =
    'inline-flex items-center justify-center font-label-bold rounded-full transition-colors duration-standard ease-standard disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

  const variants = {
    primary: 'bg-primary-container text-on-primary hover:bg-primary shadow-resting',
    secondary: 'bg-secondary-container text-on-secondary-container hover:bg-secondary/20',
    outline: 'border border-outline-variant text-on-surface hover:bg-surface-container',
    ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
    danger: 'bg-error text-on-error hover:bg-error/90 shadow-resting',
  };

  const sizes = {
    sm: 'h-9 px-4 text-xs',
    md: 'h-12 px-6 text-sm',
    lg: 'h-14 px-8 text-base',
  };

  return (
    <motion.button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...(style !== undefined ? { style: style as MotionStyle } : {})}
      {...pressableProps}
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
    </motion.button>
  );
};
