import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  isPrimaryLoading?: boolean;
  variant?: 'default' | 'danger';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  primaryActionLabel,
  onPrimaryAction,
  isPrimaryLoading,
  variant = 'default',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-on-background/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={cn(
          'bg-surface-bright w-full max-w-md rounded-2xl p-lg shadow-xl border border-outline-variant/30 space-y-md animate-in zoom-in-95 duration-200'
        )}
      >
        <div className="flex justify-between items-start">
          <h2 className="font-headline-lg-mobile text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors p-2.5 -mr-1 -mt-1 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {description && (
          <p className="font-body-md text-on-surface-variant leading-relaxed">
            {description}
          </p>
        )}

        {children && <div className="py-2">{children}</div>}

        <div className="flex justify-end items-center gap-md pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {primaryActionLabel && onPrimaryAction && (
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onPrimaryAction}
              isLoading={isPrimaryLoading}
            >
              {primaryActionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
