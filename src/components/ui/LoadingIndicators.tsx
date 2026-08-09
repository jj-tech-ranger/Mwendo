import React from 'react';
import { cn } from '../../lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'neutral';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', variant = 'primary', className }) => {
  const sizes = {
    sm: 'text-base',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-6xl',
  };

  const colors = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    neutral: 'text-on-surface-variant',
  };

  return (
    <span
      className={cn('material-symbols-outlined animate-spin select-none', sizes[size], colors[variant], className)}
    >
      progress_activity
    </span>
  );
};

export interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  size = 'md',
  className,
}) => {
  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
  };

  return (
    <div className={cn('w-full space-y-1', className)}>
      {label && (
        <div className="flex justify-between items-center text-xs font-label-mono">
          <span className="text-on-surface-variant uppercase">{label}</span>
          <span className="text-on-surface font-bold">{Math.round(progress)}%</span>
        </div>
      )}
      <div className={cn('w-full bg-surface-container rounded-full overflow-hidden', heights[size])}>
        <div
          className="bg-primary h-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};

export interface PulsingRingProps {
  size?: number; // px
  color?: string;
  className?: string;
}

export const PulsingRing: React.FC<PulsingRingProps> = ({ size = 64, className }) => {
  return (
    <div
      className={cn('relative flex items-center justify-center shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" />
      <span className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
      <span className="relative z-10 w-4 h-4 rounded-full bg-primary shadow-md" />
    </div>
  );
};
