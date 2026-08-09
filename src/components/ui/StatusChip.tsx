import React from 'react';
import { cn } from '../../lib/utils';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  riskLevel?: 'safe' | 'caution' | 'danger' | 'info';
  score?: number; // 0 - 100
  label?: string;
  rank?: 1 | 2 | 3; // Medal ranks for leaderboards
}

/**
 * Risk-coded Status Chip primitive.
 * Green = Safe / Low Risk (0-30 risk score or high safety score)
 * Amber = Caution / Moderate Risk (31-60 risk score)
 * Red = Danger / High Risk (61-100 risk score)
 */
export const StatusChip: React.FC<StatusChipProps> = ({
  riskLevel,
  score,
  label,
  rank,
  className,
  children,
  ...props
}) => {
  // Infer risk level from numerical score if provided
  let computedRisk: 'safe' | 'caution' | 'danger' | 'info' = riskLevel || 'info';

  if (score !== undefined) {
    if (score <= 30) computedRisk = 'safe';
    else if (score <= 60) computedRisk = 'caution';
    else computedRisk = 'danger';
  }

  const styles = {
    safe: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    caution: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  };

  const dots = {
    safe: 'bg-emerald-500',
    caution: 'bg-amber-500 animate-pulse',
    danger: 'bg-rose-500 animate-pulse',
    info: 'bg-sky-500',
  };

  if (rank) {
    const medals = {
      1: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200',
      2: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200',
      3: 'bg-amber-900/20 text-amber-700 border-amber-600/30 dark:text-amber-400',
    };
    const medalIcons = { 1: '🏆 1st', 2: '🥈 2nd', 3: '🥉 3rd' };

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-label-mono border font-bold',
          medals[rank],
          className
        )}
        {...props}
      >
        {medalIcons[rank]}
      </span>
    );
  }

  const displayLabel = label || children || (score !== undefined ? `${score} Risk` : computedRisk.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-label-mono border tracking-wider uppercase font-semibold select-none',
        styles[computedRisk],
        className
      )}
      {...props}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dots[computedRisk])} />
      <span>{displayLabel}</span>
    </span>
  );
};
