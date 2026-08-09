import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface EmptyStateProps {
  illustration?: string;
  icon?: string;
  title: string;
  description: string;
  primaryCtaLabel?: string;
  onPrimaryCta?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  illustration,
  icon = 'inbox',
  title,
  description,
  primaryCtaLabel,
  onPrimaryCta,
  secondaryCtaLabel,
  onSecondaryCta,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-lg sm:p-xl bg-surface-container-low/50 rounded-2xl border border-outline-variant/20 my-md',
        className
      )}
    >
      {illustration ? (
        <div className="w-32 h-32 sm:w-40 sm:h-40 mb-md overflow-hidden rounded-xl flex items-center justify-center">
          <img src={illustration} alt={title} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-secondary-container/40 flex items-center justify-center mb-md text-secondary">
          <span className="material-symbols-outlined text-3xl">{icon}</span>
        </div>
      )}

      <h3 className="font-headline-lg-mobile sm:font-headline-lg text-on-surface mb-xs">
        {title}
      </h3>
      <p className="font-body-md text-on-surface-variant max-w-md mb-lg leading-relaxed">
        {description}
      </p>

      {(primaryCtaLabel || secondaryCtaLabel) && (
        <div className="flex flex-col sm:flex-row items-center gap-md w-full max-w-xs sm:max-w-none justify-center">
          {primaryCtaLabel && onPrimaryCta && (
            <Button onClick={onPrimaryCta} variant="primary" className="w-full sm:w-auto">
              {primaryCtaLabel}
            </Button>
          )}
          {secondaryCtaLabel && onSecondaryCta && (
            <Button onClick={onSecondaryCta} variant="outline" className="w-full sm:w-auto">
              {secondaryCtaLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
