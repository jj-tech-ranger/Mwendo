import React from 'react';
import { motion } from 'motion/react';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { BrandLoader } from '../../components/ui/LoadingIndicators';
import { useMotionPresets } from '../../lib/motion';

export const LoadingAuthScreen: React.FC = () => {
  const variants = useMotionPresets();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-md bg-on-background/60 backdrop-blur-md"
      aria-live="polite"
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={variants.scaleIn}
        className="bg-surface-bright w-full max-w-[300px] rounded-2xl p-lg flex flex-col items-center text-center shadow-overlay border border-outline-variant/20"
      >
        <img
          src={BRAND_ASSETS.appIcon}
          alt=""
          aria-hidden="true"
          className="w-12 h-12 mb-5 rounded-xl shadow-sm"
        />
        <BrandLoader size="sm" className="mb-5" />
        <h2 className="font-body-md text-on-surface font-medium mb-1">Checking for updates…</h2>
        <p className="font-label-mono text-on-surface-variant/70 text-[10px] tracking-wider uppercase">
          VERIFYING SYSTEM INTEGRITY
        </p>
      </motion.div>
    </div>
  );
};
