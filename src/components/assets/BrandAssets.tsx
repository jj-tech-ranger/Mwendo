import React from 'react';

/**
 * Official Mwendo Salama brand assets.
 *
 * Keep application branding behind this module so screens and shells do not
 * recreate the logo/mark with inline SVGs or text. The source artwork lives
 * in public/brand and should be treated as the canonical visual identity.
 */
export const BRAND_ASSETS = {
  lightLogo: '/brand/logo-light.png',
  darkLogo: '/brand/logo-dark.png',
  lightIcon: '/brand/favicon-light.png',
  darkIcon: '/brand/favicon-dark.png',
  primaryLogo: '/brand/logo-light.png',
  secondaryLogo: '/brand/logo-dark.png',
  brandMark: '/brand/favicon-light.png',
  appIcon: '/brand/favicon-dark.png',
  favicon: '/brand/favicon-light.png',
  // These legacy illustration keys are retained for compatibility with
  // existing screens, but deliberately resolve to official brand artwork.
  speedometerIllustration: '/brand/favicon-light.png',
  mapIllustration: '/brand/favicon-dark.png',
  aiNetworkIllustration: '/brand/logo-light.png',
  disconnectedIllustration: '/brand/logo-dark.png',
  maintenanceIllustration: '/brand/logo-light.png',
  calendarClockIllustration: '/brand/favicon-dark.png',
} as const;

type BrandProps = {
  className?: string;
  isDark?: boolean;
};

const logoSrc = (isDark: boolean) =>
  isDark ? BRAND_ASSETS.darkLogo : BRAND_ASSETS.lightLogo;

const iconSrc = (isDark: boolean) =>
  isDark ? BRAND_ASSETS.darkIcon : BRAND_ASSETS.lightIcon;

/** Full official Mwendo Salama logo. */
export const MwendoSalamaFullLogo: React.FC<BrandProps> = ({
  className = 'h-24 w-auto',
  isDark = false,
}) => (
  <img
    src={logoSrc(isDark)}
    alt="Mwendo Salama"
    className={`object-contain ${className}`}
  />
);

/** Primary logo used on light surfaces. */
export const PrimaryLogo: React.FC<BrandProps> = ({
  className = 'h-16 w-auto',
  isDark = false,
}) => (
  <MwendoSalamaFullLogo className={className} isDark={isDark} />
);

/** Official logo variant intended for dark surfaces. */
export const SecondaryLogo: React.FC<Omit<BrandProps, 'isDark'>> = ({
  className = 'h-16 w-auto',
}) => <MwendoSalamaFullLogo className={className} isDark />;

/** Official Mwendo Salama brand mark/favicon artwork. */
export const ShieldSpeedometerMark: React.FC<BrandProps & {
  color?: string;
  bgColor?: string;
  isSquare?: boolean;
}> = ({ className = 'h-10 w-10', isDark = false }) => (
  <img
    src={iconSrc(isDark)}
    alt="Mwendo Salama safety mark"
    className={`object-contain ${className}`}
  />
);

export const BrandMark: React.FC<BrandProps> = ({
  className = 'h-10 w-10',
  isDark = false,
}) => (
  <img
    src={iconSrc(isDark)}
    alt="Mwendo Salama"
    className={`object-contain ${className}`}
  />
);

export const AppIcon: React.FC<BrandProps> = ({
  className = 'h-12 w-12',
  isDark = true,
}) => (
  <img
    src={iconSrc(isDark)}
    alt="Mwendo Salama"
    className={`object-contain ${className}`}
  />
);

/**
 * Backwards-compatible horizontal logo API.
 * It now renders the official full logo instead of reconstructing the
 * branding from a mark + separately typeset text.
 */
export const HorizontalLogo: React.FC<BrandProps> = ({
  className = 'h-10 w-auto',
  isDark = false,
}) => <MwendoSalamaFullLogo className={className} isDark={isDark} />;
