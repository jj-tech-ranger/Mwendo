import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { usePressableMotionProps } from '../../lib/motion';

interface SosButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'style'> {
  label?: string;
  variant?: 'row' | 'fab';
  style?: React.CSSProperties;
}

export const SosButton: React.FC<SosButtonProps> = ({
  className,
  label = 'Emergency SOS',
  variant = 'fab',
  style,
  ...props
}) => {
  const pressableProps = usePressableMotionProps();

  return (
    <motion.button
      type="button"
      className={cn(
        'bg-error text-on-error border border-error/70 font-label-bold select-none cursor-pointer sos-breathe',
        variant === 'row'
          ? 'w-full min-h-[76px] rounded-2xl px-5 py-4 flex items-center justify-between text-left shadow-floating'
          : 'w-14 h-14 rounded-full flex items-center justify-center shadow-floating border-2 border-error/70',
        className
      )}
      {...(style !== undefined ? { style: style as React.CSSProperties & Record<string, unknown> } : {})}
      {...pressableProps}
      whileTap={pressableProps.whileTap ? { scale: 0.92 } : undefined}
      {...props}
    >
      {variant === 'row' ? (
        <span className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-on-error/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">sos</span>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black">{label}</span>
            <span className="block text-xs font-medium opacity-80 mt-0.5">Tap for immediate help</span>
          </span>
        </span>
      ) : (
        <span className="text-xs tracking-wider font-mono font-black" aria-hidden="true">SOS</span>
      )}
    </motion.button>
  );
};
