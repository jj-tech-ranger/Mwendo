import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './Button';
import { useMotionPresets } from '../../lib/motion';
import { cn } from '../../lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  isPrimaryLoading?: boolean;
  variant?: 'primary' | 'danger';
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
  variant = 'primary',
}) => {
  const variants = useMotionPresets();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={variants.fadeIn}
          className="fixed inset-0 z-50 flex items-center justify-center p-md bg-on-background/60 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={variants.scaleIn}
            className="bg-surface-bright w-full max-w-md rounded-2xl p-lg shadow-overlay border border-outline-variant/30 space-y-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-md">
              <div className="space-y-xs">
                <h2 className="font-headline-sm text-on-surface">{title}</h2>
                {description && (
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className={cn(
                  'material-symbols-outlined shrink-0 rounded-full p-2 text-on-surface-variant hover:bg-surface-container transition-colors',
                )}
              >
                close
              </button>
            </div>

            {children && <div className="py-2">{children}</div>}

            <div className="flex justify-end items-center gap-md pt-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {primaryActionLabel && onPrimaryAction && (
                <Button
                  variant={variant === 'danger' ? 'danger' : 'primary'}
                  onClick={onPrimaryAction}
                  {...(isPrimaryLoading !== undefined ? { isLoading: isPrimaryLoading } : {})}
                >
                  {primaryActionLabel}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
