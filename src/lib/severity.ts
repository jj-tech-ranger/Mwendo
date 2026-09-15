import { SeverityLevel } from '../types';
import { BadgeVariant } from '../components/ui/Badge';

/**
 * Options for severity badge mapping.
 */
export interface SeverityBadgeOptions {
  /**
   * For metrics where "low" represents a positive/favorable standing (e.g. low vehicle risk tier),
   * callers can set lowVariant: 'success' (green). Default is 'info' (blue).
   */
  lowVariant?: BadgeVariant;
}

/**
 * Maps a severity or risk-tier level to a canonical visual Badge variant.
 *
 * Canonical mapping:
 * - 'critical' -> 'danger' (error red)
 * - 'high'     -> 'danger' (error red)
 * - 'medium'   -> 'warning' (tertiary amber)
 * - 'moderate' -> 'warning' (tertiary amber)
 * - 'low'      -> 'info' (blue by default; 'success' if lowVariant: 'success')
 * - unrecognized / missing -> 'neutral' (surface-container gray fallback)
 *
 * @param severity The severity or risk tier string
 * @param options Configuration options, e.g. custom lowVariant
 * @returns The canonical BadgeVariant
 */
export function severityToBadgeVariant(
  severity?: string | SeverityLevel | null,
  options?: SeverityBadgeOptions
): BadgeVariant {
  if (!severity || typeof severity !== 'string') {
    return 'neutral';
  }

  const normalized = severity
    .toLowerCase()
    .trim()
    .replace(/[\s_-]?risk$/, '')
    .trim();

  switch (normalized) {
    case 'critical':
    case 'high':
      return 'danger';
    case 'medium':
    case 'moderate':
      return 'warning';
    case 'low':
      return options?.lowVariant ?? 'info';
    default:
      return 'neutral';
  }
}

/**
 * Alias for severityToBadgeVariant.
 */
export const getSeverityBadgeVariant = severityToBadgeVariant;

/**
 * Canonical helper for vehicle and commuter risk tiers where 'low' risk
 * represents safe standing ('success' variant).
 */
export function riskTierToBadgeVariant(
  tier?: string | SeverityLevel | null
): BadgeVariant {
  return severityToBadgeVariant(tier, { lowVariant: 'success' });
}
