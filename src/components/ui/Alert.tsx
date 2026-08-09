import React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  icon?: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  icon,
  onDismiss,
  children,
  className,
  ...props
}) => {
  const styles = {
    info: 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/30',
    warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30',
    success: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30',
  };

  const defaultIcons = {
    info: 'info',
    warning: 'warning',
    danger: 'report_problem',
    success: 'check_circle',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-md p-md rounded-xl border text-sm font-body-md transition-all',
        styles[variant],
        className
      )}
      {...props}
    >
      <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">
        {icon || defaultIcons[variant]}
      </span>
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-label-bold text-xs uppercase tracking-wider mb-1">{title}</h5>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="opacity-70 hover:opacity-100 transition-opacity p-1 text-current shrink-0"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      )}
    </div>
  );
};
