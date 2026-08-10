import React from 'react';

// Pure SVG Data URIs matching user's exact dark and light mode designs
const buildDataUri = (svgStr: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;

const lightIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="#ffffff"/><path d="M 100 22 C 138 36, 172 42, 172 82 C 172 136, 126 168, 100 180 C 74 168, 28 136, 28 82 C 28 42, 62 36, 100 22 Z" fill="none" stroke="#1b4d2e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M 68 126 A 38 38 0 1 1 132 126" fill="none" stroke="#1b4d2e" stroke-width="13" stroke-linecap="round"/><circle cx="100" cy="110" r="10" fill="none" stroke="#1b4d2e" stroke-width="7"/><path d="M 104 104 L 132 76" stroke="#1b4d2e" stroke-width="13" stroke-linecap="round"/></svg>`;

const darkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" rx="32" ry="32" fill="#1b4d2e"/><path d="M 100 32 C 132 44, 160 48, 160 84 C 160 130, 122 158, 100 168 C 78 158, 40 130, 40 84 C 40 48, 68 44, 100 32 Z" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M 72 122 A 32 32 0 1 1 128 122" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round"/><circle cx="100" cy="108" r="9" fill="none" stroke="#ffffff" stroke-width="6"/><path d="M 103 103 L 126 80" stroke="#ffffff" stroke-width="11" stroke-linecap="round"/></svg>`;

const lightFullLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500"><rect width="400" height="500" fill="#fcfdfc"/><g transform="translate(100, 25)"><path d="M 100 22 C 138 36, 172 42, 172 82 C 172 136, 126 168, 100 180 C 74 168, 28 136, 28 82 C 28 42, 62 36, 100 22 Z" fill="none" stroke="#1b4d2e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M 68 126 A 38 38 0 1 1 132 126" fill="none" stroke="#1b4d2e" stroke-width="13" stroke-linecap="round"/><circle cx="100" cy="110" r="10" fill="none" stroke="#1b4d2e" stroke-width="7"/><path d="M 104 104 L 132 76" stroke="#1b4d2e" stroke-width="13" stroke-linecap="round"/></g><text x="200" y="270" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="800" font-size="52" fill="#050505" letter-spacing="-1">Mwendo</text><text x="200" y="335" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="800" font-size="52" fill="#050505" letter-spacing="-1">Salama</text><text x="200" y="385" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="22" fill="#555555">Travel safer. Arrive safer.</text></svg>`;

const darkFullLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500"><rect width="400" height="500" fill="#1b4d2e"/><g transform="translate(100, 25)"><path d="M 100 22 C 138 36, 172 42, 172 82 C 172 136, 126 168, 100 180 C 74 168, 28 136, 28 82 C 28 42, 62 36, 100 22 Z" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M 68 126 A 38 38 0 1 1 132 126" fill="none" stroke="#ffffff" stroke-width="13" stroke-linecap="round"/><circle cx="100" cy="110" r="10" fill="none" stroke="#ffffff" stroke-width="7"/><path d="M 104 104 L 132 76" stroke="#ffffff" stroke-width="13" stroke-linecap="round"/></g><text x="200" y="270" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="800" font-size="52" fill="#ffffff" letter-spacing="-1">Mwendo</text><text x="200" y="335" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="800" font-size="52" fill="#ffffff" letter-spacing="-1">Salama</text><text x="200" y="385" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="22" fill="#d0e1d4">Travel safer. Arrive safer.</text></svg>`;

export const BRAND_ASSETS = {
  // Image Data URIs
  lightIcon: buildDataUri(lightIconSvg),
  darkIcon: buildDataUri(darkIconSvg),
  lightLogo: buildDataUri(lightFullLogoSvg),
  darkLogo: buildDataUri(darkFullLogoSvg),

  // Backwards compatibility mappings for app references
  primaryLogo: buildDataUri(lightFullLogoSvg),
  secondaryLogo: buildDataUri(darkFullLogoSvg),
  brandMark: buildDataUri(lightIconSvg),
  appIcon: buildDataUri(darkIconSvg),
  favicon: buildDataUri(lightIconSvg),

  // Standard illustrations
  speedometerIllustration: buildDataUri(lightIconSvg),
  mapIllustration: buildDataUri(darkIconSvg),
  aiNetworkIllustration: buildDataUri(lightFullLogoSvg),
  disconnectedIllustration: buildDataUri(darkFullLogoSvg),
  maintenanceIllustration: buildDataUri(lightFullLogoSvg),
  calendarClockIllustration: buildDataUri(darkFullLogoSvg),
};

// Reusable SVG Shield + Speedometer Mark
export const ShieldSpeedometerMark: React.FC<{
  className?: string;
  color?: string;
  bgColor?: string;
  isSquare?: boolean;
}> = ({ className = 'w-10 h-10', color = '#1b4d2e', bgColor, isSquare = false }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={className}
    >
      {bgColor && (
        <rect
          width="200"
          height="200"
          rx={isSquare ? 32 : 0}
          ry={isSquare ? 32 : 0}
          fill={bgColor}
        />
      )}
      <path
        d="M 100 22 C 138 36, 172 42, 172 82 C 172 136, 126 168, 100 180 C 74 168, 28 136, 28 82 C 28 42, 62 36, 100 22 Z"
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 68 126 A 38 38 0 1 1 132 126"
        fill="none"
        stroke={color}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <circle cx="100" cy="110" r="10" fill="none" stroke={color} strokeWidth="7" />
      <path d="M 104 104 L 132 76" stroke={color} strokeWidth="13" strokeLinecap="round" />
    </svg>
  );
};

// Reusable Full Mwendo Salama Logo (Icon + Text + Tagline)
export const MwendoSalamaFullLogo: React.FC<{
  className?: string;
  isDark?: boolean;
}> = ({ className = 'h-40 w-auto', isDark = false }) => {
  const color = isDark ? '#ffffff' : '#1b4d2e';
  const textColor = isDark ? '#ffffff' : '#050505';
  const tagColor = isDark ? '#d0e1d4' : '#555555';
  const bgColor = isDark ? '#1b4d2e' : 'transparent';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 480"
      className={className}
    >
      {bgColor !== 'transparent' && <rect width="400" height="480" fill={bgColor} rx="24" />}
      <g transform="translate(100, 20)">
        <path
          d="M 100 22 C 138 36, 172 42, 172 82 C 172 136, 126 168, 100 180 C 74 168, 28 136, 28 82 C 28 42, 62 36, 100 22 Z"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 68 126 A 38 38 0 1 1 132 126"
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
        />
        <circle cx="100" cy="110" r="10" fill="none" stroke={color} strokeWidth="7" />
        <path d="M 104 104 L 132 76" stroke={color} strokeWidth="13" strokeLinecap="round" />
      </g>
      <text
        x="200"
        y="265"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="52"
        fill={textColor}
        letterSpacing="-1"
      >
        Mwendo
      </text>
      <text
        x="200"
        y="330"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fontSize="52"
        fill={textColor}
        letterSpacing="-1"
      >
        Salama
      </text>
      <text
        x="200"
        y="380"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="500"
        fontSize="22"
        fill={tagColor}
      >
        Travel safer. Arrive safer.
      </text>
    </svg>
  );
};

// React Component Exports
export const PrimaryLogo: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = 'h-16 w-auto',
  isDark = false,
}) => <MwendoSalamaFullLogo className={className} isDark={isDark} />;

export const HorizontalLogo: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = 'h-8',
  isDark = false,
}) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <ShieldSpeedometerMark
      className="h-8 w-8 shrink-0"
      color={isDark ? '#ffffff' : '#1b4d2e'}
      bgColor={isDark ? '#1b4d2e' : undefined}
      isSquare={isDark}
    />
    <div className="flex flex-col leading-none">
      <span className={`font-black text-lg tracking-tight ${isDark ? 'text-white' : 'text-on-surface'}`}>
        Mwendo<span className={isDark ? 'text-emerald-400' : 'text-primary'}>Salama</span>
      </span>
      <span className={`text-[9px] font-medium tracking-wider uppercase ${isDark ? 'text-emerald-200/80' : 'text-on-surface-variant/80'}`}>
        Safe Journeys
      </span>
    </div>
  </div>
);

export const SecondaryLogo: React.FC<{ className?: string }> = ({ className = 'h-16 w-auto' }) => (
  <MwendoSalamaFullLogo className={className} isDark={true} />
);

export const BrandMark: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = 'h-10 w-10',
  isDark = false,
}) => (
  <ShieldSpeedometerMark
    className={className}
    color={isDark ? '#ffffff' : '#1b4d2e'}
    bgColor={isDark ? '#1b4d2e' : undefined}
    isSquare={isDark}
  />
);

export const AppIcon: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = 'h-12 w-12',
  isDark = true,
}) => (
  <ShieldSpeedometerMark
    className={className}
    color={isDark ? '#ffffff' : '#1b4d2e'}
    bgColor={isDark ? '#1b4d2e' : undefined}
    isSquare={true}
  />
);
