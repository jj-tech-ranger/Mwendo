import { useReducedMotion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';

/**
 * Shared motion tokens. CSS uses milliseconds while Motion uses seconds;
 * the values intentionally describe the same timings and easing curves.
 */
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  standard: 0.2,
  moderate: 0.3,
  emphasized: 0.45,
} as const;

export const EASE = {
  standard: [0.2, 0, 0, 1] as const,
  standardDecelerate: [0, 0, 0, 1] as const,
  standardAccelerate: [0.3, 0, 1, 1] as const,
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1] as const,
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15] as const,
} as const;

const REDUCED_MOTION_DURATION = 0.01;

export const variants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: DURATION.standard,
        ease: EASE.standardDecelerate,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: DURATION.fast,
        ease: EASE.standardAccelerate,
      },
    },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: DURATION.emphasized,
        ease: EASE.emphasizedDecelerate,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: DURATION.fast,
        ease: EASE.standardAccelerate,
      },
    },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: DURATION.standard,
        ease: EASE.standardDecelerate,
      },
    },
    exit: {
      opacity: 0,
      y: 8,
      transition: {
        duration: DURATION.fast,
        ease: EASE.standardAccelerate,
      },
    },
  },
  toast: {
    hidden: { opacity: 0, y: 12, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: DURATION.standard,
        ease: EASE.standardDecelerate,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transition: {
        duration: DURATION.fast,
        ease: EASE.standardAccelerate,
      },
    },
  },
} as const;

/**
 * Returns the shared variants with reduced-motion transitions collapsed to 10ms.
 * Keeping this hook as the component entry point prevents individual primitives
 * from inventing their own motion/reduced-motion behavior.
 */
export function useMotionPresets() {
  const shouldReduceMotion = useReducedMotion();

  if (!shouldReduceMotion) return variants;

  const reduced = (variant: Record<string, unknown>) => {
    const transition = (variant.transition ?? {}) as Record<string, unknown>;
    return {
      ...variant,
      transition: {
        ...transition,
        duration: REDUCED_MOTION_DURATION,
      },
    };
  };

  return {
    fadeIn: {
      hidden: reduced(variants.fadeIn.hidden),
      visible: reduced(variants.fadeIn.visible),
      exit: reduced(variants.fadeIn.exit),
    },
    scaleIn: {
      hidden: reduced(variants.scaleIn.hidden),
      visible: reduced(variants.scaleIn.visible),
      exit: reduced(variants.scaleIn.exit),
    },
    staggerItem: {
      hidden: reduced(variants.staggerItem.hidden),
      visible: reduced(variants.staggerItem.visible),
      exit: reduced(variants.staggerItem.exit),
    },
    toast: {
      hidden: reduced(variants.toast.hidden),
      visible: reduced(variants.toast.visible),
      exit: reduced(variants.toast.exit),
    },
  };
}

/**
 * Shared direct-manipulation feedback for buttons and other pressable controls.
 * Reduced motion intentionally returns no animation props at all.
 */
export function usePressableMotionProps(): HTMLMotionProps<'button'> {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) return {};

  return {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.96 },
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  };
}
