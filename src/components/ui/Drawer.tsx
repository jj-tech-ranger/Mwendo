import React from 'react';
import { cn } from '../../lib/utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'bottom' | 'right' | 'left';
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom',
  className,
}) => {
  if (!isOpen) return null;

  const positions = {
    bottom: 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl animate-in slide-in-from-bottom duration-300',
    right: 'inset-y-0 right-0 w-full sm:w-96 rounded-l-2xl animate-in slide-in-from-right duration-300',
    left: 'inset-y-0 left-0 w-full sm:w-96 rounded-r-2xl animate-in slide-in-from-left duration-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-on-background/60 backdrop-blur-xs">
      {/* Backdrop click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Drawer Panel */}
      <div
        className={cn(
          'relative z-10 bg-surface-bright border-t border-outline-variant/30 p-lg shadow-2xl flex flex-col space-y-md overflow-y-auto',
          positions[position],
          className
        )}
      >
        {/* Handle for bottom sheet */}
        {position === 'bottom' && (
          <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto shrink-0 mb-1" />
        )}

        <div className="flex justify-between items-center shrink-0">
          {title && <h3 className="font-headline-lg-mobile text-lg text-on-surface font-bold">{title}</h3>}
          <button
            onClick={onClose}
            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors ml-auto"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
