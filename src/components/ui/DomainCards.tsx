import React from 'react';
import { Card } from './Card';
import { StatusChip } from './StatusChip';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { cn } from '../../lib/utils';

/* ==========================================
 * 1. MetricCard / StatCard
 * ========================================== */
export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number; // e.g. +12 or -5
    label?: string; // e.g. "vs last 30d"
    isPositiveGood?: boolean;
  };
  icon?: string;
  variant?: 'default' | 'flat' | 'elevated' | 'outline';
  themeContext?: 'passenger' | 'sacco' | 'authority' | 'admin-ops';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = 'default',
  themeContext = 'passenger',
  className,
}) => {
  const isUp = trend && trend.value > 0;
  const isGood = trend ? (trend.isPositiveGood !== false ? isUp : !isUp) : true;

  const opsBg =
    themeContext === 'admin-ops'
      ? 'bg-slate-900 border-slate-800 text-slate-100'
      : '';

  return (
    <Card variant={variant} className={cn('space-y-2 relative overflow-hidden', opsBg, className)}>
      <div className="flex justify-between items-start">
        <span className="font-label-bold text-xs uppercase tracking-wider text-on-surface-variant/80">
          {title}
        </span>
        {icon && (
          <span
            className={cn(
              'material-symbols-outlined text-2xl',
              themeContext === 'authority'
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-primary'
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="font-display-md text-3xl font-label-mono text-on-surface tracking-tight font-bold">
        {value}
      </div>

      {(trend || subtitle) && (
        <div className="flex items-center gap-2 text-xs font-body-sm pt-1">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center font-label-mono font-bold px-1.5 py-0.5 rounded',
                isGood
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
              )}
            >
              <span className="material-symbols-outlined text-sm">
                {isUp ? 'trending_up' : 'trending_down'}
              </span>
              {trend.value > 0 ? `+${trend.value}%` : `${trend.value}%`}
            </span>
          )}
          <span className="text-on-surface-variant/70 font-body-sm">
            {trend?.label || subtitle}
          </span>
        </div>
      )}
    </Card>
  );
};

/* ==========================================
 * 2. VehicleCard
 * ========================================== */
export interface VehicleCardProps {
  plateNumber: string;
  saccoName: string;
  routeName: string;
  capacity?: number;
  riskScore?: number;
  totalViolations?: number;
  isProvisional?: boolean;
  status?: 'active' | 'inactive' | 'flagged';
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  plateNumber,
  saccoName,
  routeName,
  capacity = 14,
  riskScore = 18,
  totalViolations = 2,
  isProvisional = false,
  status = 'active',
  onAction,
  actionLabel = 'Manage Vehicle',
  className,
}) => {
  return (
    <Card variant="default" className={cn('space-y-md hover:border-primary/40 transition-colors', className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-mono text-lg font-bold text-on-surface px-2.5 py-1 bg-surface-container-high rounded-md border border-outline-variant/30">
              {plateNumber}
            </span>
            {isProvisional ? (
              <Badge variant="warning">Provisional</Badge>
            ) : (
              <Badge variant={status === 'active' ? 'success' : 'danger'}>
                {status.toUpperCase()}
              </Badge>
            )}
          </div>
          <h4 className="font-headline-lg-mobile text-sm text-on-surface font-semibold">{saccoName}</h4>
          <p className="font-body-sm text-xs text-on-surface-variant">{routeName}</p>
        </div>
        <StatusChip score={riskScore} />
      </div>

      <div className="grid grid-cols-3 gap-2 py-2 border-y border-outline-variant/20 font-body-sm text-xs">
        <div>
          <span className="text-on-surface-variant/70 block uppercase font-label-bold text-[10px]">Capacity</span>
          <span className="font-label-mono text-on-surface font-medium">{capacity} seats</span>
        </div>
        <div>
          <span className="text-on-surface-variant/70 block uppercase font-label-bold text-[10px]">Violations</span>
          <span className="font-label-mono text-on-surface font-medium">{totalViolations} logged</span>
        </div>
        <div>
          <span className="text-on-surface-variant/70 block uppercase font-label-bold text-[10px]">Risk Level</span>
          <span className="font-label-bold text-on-surface">
            {riskScore <= 30 ? 'Low' : riskScore <= 60 ? 'Moderate' : 'High'}
          </span>
        </div>
      </div>

      {onAction && (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
};

/* ==========================================
 * 3. TripCard
 * ========================================== */
export interface TripCardProps {
  routeName: string;
  plateNumber: string;
  saccoName: string;
  startTime: string;
  durationMinutes: number;
  maxSpeedKmh: number;
  violationsCount: number;
  safetyScore: number;
  status: 'active' | 'completed' | 'auto_completed' | 'incomplete_signal_lost';
  onSelect?: () => void;
  className?: string;
}

export const TripCard: React.FC<TripCardProps> = ({
  routeName,
  plateNumber,
  saccoName,
  startTime,
  durationMinutes,
  maxSpeedKmh,
  violationsCount,
  safetyScore,
  status,
  onSelect,
  className,
}) => {
  return (
    <Card
      variant="default"
      className={cn(
        'space-y-md cursor-pointer hover:border-primary/50 transition-all active:scale-[0.99]',
        status === 'active' && 'border-primary/60 bg-primary-container/10',
        className
      )}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start">
        <div>
          <span className="font-label-mono text-xs text-on-surface-variant block mb-0.5">{startTime}</span>
          <h3 className="font-headline-lg-mobile text-base text-on-surface font-bold">{routeName}</h3>
          <p className="font-body-sm text-xs text-on-surface-variant">{saccoName}</p>
        </div>
        <div className="text-right">
          <span className="font-label-mono text-xs font-bold px-2 py-0.5 bg-surface-container rounded border border-outline-variant/30 block mb-1">
            {plateNumber}
          </span>
          <Badge
            variant={
              status === 'active'
                ? 'success'
                : status === 'completed'
                ? 'info'
                : 'warning'
            }
          >
            {status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/20 font-body-sm text-xs">
        <div>
          <span className="text-on-surface-variant/70 block uppercase font-label-bold text-[10px]">Duration</span>
          <span className="font-label-mono text-on-surface font-medium">{durationMinutes} mins</span>
        </div>
        <div>
          <span className="text-on-surface-variant/70 block uppercase font-label-bold text-[10px]">Max Speed</span>
          <span
            className={cn(
              'font-label-mono font-bold',
              maxSpeedKmh > 80 ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface'
            )}
          >
            {maxSpeedKmh} km/h
          </span>
        </div>
        <div>
          <span className="text-on-surface-variant/70 block uppercase font-label-bold text-[10px]">Safety Score</span>
          <span className="font-label-mono font-bold text-primary">{safetyScore}%</span>
        </div>
      </div>
    </Card>
  );
};

/* ==========================================
 * 4. HazardCard / BlackSpotCard
 * ========================================== */
export interface HazardCardProps {
  title: string;
  hazardType: string;
  locationName: string;
  severity: 'low' | 'medium' | 'high';
  corroborations: number;
  status: 'pending' | 'published' | 'rejected';
  imageUrl?: string;
  onAction?: () => void;
  className?: string;
}

export const HazardCard: React.FC<HazardCardProps> = ({
  title,
  hazardType,
  locationName,
  severity,
  corroborations,
  status,
  imageUrl,
  onAction,
  className,
}) => {
  const severityBadge = {
    low: 'warning',
    medium: 'warning',
    high: 'danger',
  } as const;

  return (
    <Card variant="default" className={cn('space-y-md hover:border-outline transition-colors', className)}>
      <div className="flex gap-md items-start">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-16 h-16 rounded-xl object-cover shrink-0 border border-outline-variant/30"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={severityBadge[severity]}>{severity} severity</Badge>
            <Badge variant={status === 'published' ? 'success' : status === 'pending' ? 'warning' : 'danger'}>
              {status}
            </Badge>
          </div>
          <h4 className="font-headline-lg-mobile text-sm text-on-surface font-bold truncate">{title}</h4>
          <p className="font-body-sm text-xs text-on-surface-variant truncate">{locationName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-body-sm pt-2 border-t border-outline-variant/20">
        <span className="text-on-surface-variant font-label-mono">
          Confirmed by <strong className="text-on-surface">{corroborations}</strong> commuters
        </span>
        {onAction && (
          <Button variant="ghost" size="sm" onClick={onAction} className="text-xs">
            Details
          </Button>
        )}
      </div>
    </Card>
  );
};

/* ==========================================
 * 5. AnalyticsWidget
 * ========================================== */
export interface AnalyticsWidgetProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const AnalyticsWidget: React.FC<AnalyticsWidgetProps> = ({
  title,
  subtitle,
  action,
  children,
  className,
}) => {
  return (
    <Card variant="default" className={cn('space-y-md', className)}>
      <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20">
        <div>
          <h3 className="font-headline-lg-mobile text-base text-on-surface font-bold">{title}</h3>
          {subtitle && <p className="font-body-sm text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="w-full pt-1">{children}</div>
    </Card>
  );
};

/* ==========================================
 * 6. ProfileCard
 * ========================================== */
export interface ProfileCardProps {
  displayName: string;
  email?: string;
  role: string;
  trustScore?: number;
  avatarUrl?: string;
  tripsCount?: number;
  reportsCount?: number;
  className?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  displayName,
  email,
  role,
  trustScore = 78,
  avatarUrl,
  tripsCount = 47,
  reportsCount = 9,
  className,
}) => {
  return (
    <Card variant="default" className={cn('space-y-md text-center p-lg', className)}>
      <Avatar name={displayName} src={avatarUrl} size="xl" isVerified className="mx-auto" />
      <div>
        <h3 className="font-headline-lg-mobile text-lg text-on-surface font-bold">{displayName}</h3>
        {email && <p className="font-body-sm text-xs text-on-surface-variant">{email}</p>}
        <div className="mt-2">
          <Badge variant="info">{role.toUpperCase()}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs font-body-sm">
        <div>
          <span className="block font-label-mono text-base font-bold text-on-surface">{tripsCount}</span>
          <span className="text-on-surface-variant/80 text-[10px] uppercase font-label-bold">Trips</span>
        </div>
        <div>
          <span className="block font-label-mono text-base font-bold text-primary">{trustScore}</span>
          <span className="text-on-surface-variant/80 text-[10px] uppercase font-label-bold">Trust Score</span>
        </div>
        <div>
          <span className="block font-label-mono text-base font-bold text-on-surface">{reportsCount}</span>
          <span className="text-on-surface-variant/80 text-[10px] uppercase font-label-bold">Reports</span>
        </div>
      </div>
    </Card>
  );
};
