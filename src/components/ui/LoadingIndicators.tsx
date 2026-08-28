import React from 'react';
import { cn } from '../../lib/utils';
import { BRAND_ASSETS } from '../assets/BrandAssets';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'neutral';
  className?: string;
  label?: string;
}

/** Compact loader for buttons and short async operations. */
export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', variant = 'primary', className, label = 'Loading' }) => {
  const sizes = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-7 w-7', xl: 'h-9 w-9' };
  const colors = { primary: 'border-primary/25 border-t-primary', secondary: 'border-secondary/25 border-t-secondary', neutral: 'border-on-surface-variant/25 border-t-on-surface-variant' };

  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block rounded-full border-2 motion-safe:animate-spin motion-reduce:animate-none', sizes[size], colors[variant], className)}
    />
  );
};

export interface BrandLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

/** Branded loader for screen-level initialization; intentionally not used for content skeletons. */
export const BrandLoader: React.FC<BrandLoaderProps> = ({ size = 'md', label = 'Loading Mwendo Salama', className }) => {
  const sizes = { sm: 'h-12 w-12', md: 'h-16 w-16', lg: 'h-20 w-20' };
  return (
    <div role="status" aria-label={label} className={cn('relative flex items-center justify-center', className)}>
      <span className="absolute inset-0 rounded-2xl bg-primary/10 motion-safe:animate-pulse motion-reduce:animate-none" />
      <span className="absolute inset-1 rounded-2xl border border-primary/20 motion-safe:animate-pulse motion-reduce:animate-none" />
      <img src={BRAND_ASSETS.appIcon} alt="" aria-hidden="true" className={cn('relative rounded-xl object-contain shadow-sm', sizes[size])} />
    </div>
  );
};

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

/** Layout-preserving placeholder for content that is still being fetched. */
export const Skeleton: React.FC<SkeletonProps> = ({ className, rounded = 'md', ...props }) => {
  const radius = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-xl', full: 'rounded-full' };
  return <div aria-hidden="true" className={cn('relative overflow-hidden bg-surface-container', radius[rounded], className)} {...props}>
    <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-surface-bright/60 to-transparent motion-safe:animate-[loading-shimmer_1.8s_ease-in-out_infinite] motion-reduce:hidden" />
  </div>;
};

export interface ProgressBarProps {
  progress: number;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label, size = 'md', className }) => {
  const heights = { sm: 'h-1.5', md: 'h-2.5' };
  return (
    <div className={cn('w-full space-y-1', className)}>
      {label && <div className="flex justify-between items-center text-xs font-label-mono"><span className="text-on-surface-variant uppercase">{label}</span><span className="text-on-surface font-bold">{Math.round(progress)}%</span></div>}
      <div className={cn('w-full bg-surface-container rounded-full overflow-hidden', heights[size])}><div className="bg-primary h-full transition-all duration-300 ease-out" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
    </div>
  );
};

export interface PulsingRingProps { size?: number; color?: string; className?: string; }

export const PulsingRing: React.FC<PulsingRingProps> = ({ size = 64, className }) => (
  <div className={cn('relative flex items-center justify-center shrink-0', className)} style={{ width: size, height: size }} aria-hidden="true">
    <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-ping motion-reduce:animate-none opacity-75" />
    <span className="absolute inset-2 rounded-full bg-primary/20 motion-safe:animate-pulse motion-reduce:animate-none" />
    <span className="relative z-10 w-3 h-3 rounded-full bg-primary shadow-md" />
  </div>
);
