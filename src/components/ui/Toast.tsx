import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { useMotionPresets } from '../../lib/motion';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string | undefined;
  duration?: number | undefined;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const motionPresets = useMotionPresets();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={motionPresets.toast}
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-floating border backdrop-blur-md',
                toast.type === 'success' && 'bg-emerald-900/90 text-emerald-100 border-emerald-700/50',
                toast.type === 'warning' && 'bg-amber-900/90 text-amber-100 border-amber-700/50',
                toast.type === 'error' && 'bg-rose-900/90 text-rose-100 border-rose-700/50',
                toast.type === 'info' && 'bg-slate-900/90 text-slate-100 border-slate-700/50'
              )}
            >
              <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">
                {toast.type === 'success'
                  ? 'check_circle'
                  : toast.type === 'warning'
                  ? 'warning'
                  : toast.type === 'error'
                  ? 'error'
                  : 'info'}
              </span>
              <div className="flex-1 min-w-0">
                <h5 className="font-label-bold text-xs uppercase tracking-wider">{toast.title}</h5>
                {toast.message && <p className="font-body-sm text-xs opacity-90 mt-0.5">{toast.message}</p>}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss toast"
                className="opacity-70 hover:opacity-100 transition-opacity p-2 -mr-1 -mt-1 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
