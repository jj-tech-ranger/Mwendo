import React from 'react';

/**
 * Official Mwendo Salama brand assets.
 *
 * Keep application branding behind this module so screens and shells do not
 * recreate the logo/mark with inline SVGs or text. The original artwork in
 * public/brand is immutable; public/derived contains presentation variants
 * for contexts that benefit from circular artwork and transparent corners.
 */
export const BRAND_ASSETS = {
  lightLogo: '/brand/logo-light.png',
  darkLogo: '/brand/logo-dark.png',
  lightIcon: '/brand/favicon-light.png',
  darkIcon: '/brand/favicon-dark.png',
  lightRoundLogo: '/derived/logo-round-light.png',
  darkRoundLogo: '/derived/logo-round-dark.png',
  lightRoundFavicon: '/derived/favicon-round-light.png',
  darkRoundFavicon: '/derived/favicon-round-dark.png',
  lightAppIcon: '/derived/app-icon-light.png',
  darkAppIcon: '/derived/app-icon-dark.png',
  primaryLogo: '/brand/logo-light.png',
  secondaryLogo: '/brand/logo-dark.png',
  brandMark: '/derived/favicon-round-light.png',
  appIcon: '/derived/app-icon-dark.png',
  favicon: '/derived/favicon-round-light.png',
  // Legacy illustration keys remain for compatibility; these are brand assets,
  // not true illustrations, and should not be expanded into decorative art.
  speedometerIllustration: '/derived/favicon-round-light.png',
  mapIllustration: '/derived/favicon-round-dark.png',
  aiNetworkIllustration: '/brand/logo-light.png',
  disconnectedIllustration: '/brand/logo-dark.png',
  maintenanceIllustration: '/brand/logo-light.png',
  calendarClockIllustration: '/derived/favicon-round-dark.png',
} as const;

type BrandProps = {
  className?: string;
  isDark?: boolean;
};

const logoSrc = (isDark: boolean) =>
  isDark ? BRAND_ASSETS.darkLogo : BRAND_ASSETS.lightLogo;

const roundLogoSrc = (isDark: boolean) =>
  isDark ? BRAND_ASSETS.darkRoundLogo : BRAND_ASSETS.lightRoundLogo;

const iconSrc = (isDark: boolean) =>
  isDark ? BRAND_ASSETS.darkRoundFavicon : BRAND_ASSETS.lightRoundFavicon;

const appIconSrc = (isDark: boolean) =>
  isDark ? BRAND_ASSETS.darkAppIcon : BRAND_ASSETS.lightAppIcon;

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

/** Circular full-logo presentation for splash/brand-feature contexts. */
export const CircularLogo: React.FC<BrandProps> = ({
  className = 'h-32 w-32',
  isDark = false,
}) => (
  <img
    src={roundLogoSrc(isDark)}
    alt="Mwendo Salama"
    className={`object-contain ${className}`}
  />
);

/** Official Mwendo Salama mark in the circular presentation variant. */
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

/** Larger circular app icon for launcher/PWA-style UI. */
export const AppIcon: React.FC<BrandProps> = ({
  className = 'h-12 w-12',
  isDark = true,
}) => (
  <img
    src={appIconSrc(isDark)}
    alt="Mwendo Salama"
    className={`object-contain ${className}`}
  />
);

/**
 * Backwards-compatible horizontal logo API.
 * It renders the official full logo rather than reconstructing the branding
 * from a mark + separately typeset text.
 */
export const HorizontalLogo: React.FC<BrandProps> = ({
  className = 'h-10 w-auto',
  isDark = false,
}) => <MwendoSalamaFullLogo className={className} isDark={isDark} />;
