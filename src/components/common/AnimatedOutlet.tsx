import React, { Suspense, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useMotionPresets } from '../../lib/motion';
import { BrandLoader } from '../ui/LoadingIndicators';

const ContentLoadingFallback: React.FC = () => (
  <div className="w-full h-full min-h-[300px] flex items-center justify-center p-8" aria-live="polite">
    <BrandLoader size="md" />
  </div>
);

const StableOutlet: React.FC = () => {
  const outlet = useOutlet();
  const [stableOutlet] = useState(outlet); // captured ONCE, never updated
  return <>{stableOutlet}</>;
};

export const AnimatedOutlet: React.FC = () => {
  const location = useLocation();
  const { variants } = useMotionPresets();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants.page}
      >
        <Suspense fallback={<ContentLoadingFallback />}>
          <StableOutlet />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};
