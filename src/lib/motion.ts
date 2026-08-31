import { useReducedMotion } from 'motion/react';
import type { HTMLMotionProps, Variants } from 'motion/react';

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

export const transitions = {
  enter: {
    duration: DURATION.moderate,
    ease: EASE.standardDecelerate,
  },
  exit: {
    duration: DURATION.fast,
    ease: EASE.standardAccelerate,
  },
} as const;

const REDUCED_MOTION_DURATION = 0.01;

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: transitions.enter },
  exit: { opacity: 0, y: -6, transition: transitions.exit },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.moderate,
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
};

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
  staggerContainer: staggerContainerVariants,
  staggerItem: staggerItemVariants,
  page: pageVariants,
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

  if (!shouldReduceMotion) {
    return {
      ...variants,
      variants,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reduced = (variant?: any) => {
    if (!variant || typeof variant !== 'object') return {};
    const transition = (variant.transition ? variant.transition : {}) as Record<string, unknown>;
    return {
      ...variant,
      transition: {
        ...transition,
        duration: REDUCED_MOTION_DURATION,
      },
    };
  };

  const reducedPresets = {
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
    staggerContainer: {
      hidden: {},
      visible: {
        transition: {
          staggerChildren: 0.001,
        },
      },
    },
    staggerItem: {
      hidden: reduced(variants.staggerItem.hidden),
      visible: reduced(variants.staggerItem.visible),
      exit: reduced(variants.staggerItem.exit),
    },
    page: {
      hidden: reduced(variants.page.hidden),
      visible: reduced(variants.page.visible),
      exit: reduced(variants.page.exit),
    },
    toast: {
      hidden: reduced(variants.toast.hidden),
      visible: reduced(variants.toast.visible),
      exit: reduced(variants.toast.exit),
    },
  };

  return {
    ...reducedPresets,
    variants: reducedPresets,
  };
}

type PressableMotionProps = Pick<
  HTMLMotionProps<'button'>,
  'whileHover' | 'whileTap' | 'transition'
>;

/**
 * Shared direct-manipulation feedback for buttons and other pressable controls.
 * Reduced motion intentionally returns no animation props at all.
 *
 * Keep this type intentionally narrow: HTMLMotionProps also contains native
 * attributes such as `style`, and spreading those into motion components can
 * conflict with exactOptionalPropertyTypes.
 */
export function usePressableMotionProps(): PressableMotionProps {
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

