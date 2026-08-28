import React from 'react';

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

export const PrimaryLogo: React.FC<BrandProps> = ({
  className = 'h-16 w-auto',
  isDark = false,
}) => (
  <MwendoSalamaFullLogo className={className} isDark={isDark} />
);

export const SecondaryLogo: React.FC<Omit<BrandProps, 'isDark'>> = ({
  className = 'h-16 w-auto',
}) => <MwendoSalamaFullLogo className={className} isDark />;

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

export const HorizontalLogo: React.FC<BrandProps> = ({
  className = 'h-10 w-auto',
  isDark = false,
}) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <BrandMark className="h-9 w-9 shrink-0" isDark={isDark} />
    <div className="flex flex-col leading-none">
      <span className={`font-black text-lg tracking-tight ${isDark ? 'text-white' : 'text-on-surface'}`}>
        Mwendo Salama
      </span>
      <span className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${isDark ? 'text-white/70' : 'text-on-surface-variant/80'}`}>
        Safe Journeys
      </span>
    </div>
  </div>
);
