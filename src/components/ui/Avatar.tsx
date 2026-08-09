import React from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isVerified?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

/**
 * Avatar component using generated-initials for users without a photo.
 * Never uses placeholder photography.
 */
export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  src,
  size = 'md',
  isVerified = false,
  status,
  className,
  ...props
}) => {
  // Generate initials (up to 2 letters)
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  // Deterministic color background based on name string hash
  const colorIndex = Math.abs(
    name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % 6;

  const bgColors = [
    'bg-primary-container text-on-primary',
    'bg-secondary-container text-on-secondary-container',
    'bg-tertiary-container text-on-tertiary-container',
    'bg-surface-container-high text-primary',
    'bg-primary-fixed text-on-primary-fixed-variant',
    'bg-secondary-fixed text-on-secondary-fixed-variant',
  ];

  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl font-headline-lg-mobile',
  };

  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-400',
    busy: 'bg-rose-500',
    away: 'bg-amber-500',
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center shrink-0', className)} {...props}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-label-bold overflow-hidden shadow-xs border border-outline-variant/30 select-none',
          sizes[size],
          !src && bgColors[colorIndex]
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image to fallback to initials
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {isVerified && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary text-on-primary rounded-full flex items-center justify-center text-[10px] shadow-xs border border-surface">
          <span className="material-symbols-outlined text-[12px]">check</span>
        </span>
      )}

      {status && (
        <span
          className={cn(
            'absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface',
            statusColors[status]
          )}
        />
      )}
    </div>
  );
};
