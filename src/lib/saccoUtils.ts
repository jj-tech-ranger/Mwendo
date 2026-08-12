import { SHOW_DEV_TOOLS } from './devFlags';

/**
 * Single source of truth for mapping SACCO IDs to display names.
 */
export function getSaccoName(saccoId?: string | null): string {
  if (!saccoId) return 'Unknown SACCO';
  if (saccoId === 'sacco_greenline') return 'GreenLine SACCO';
  if (saccoId === 'sacco_metrolink') return 'MetroLink SACCO';

  const clean = saccoId.replace(/^sacco_/, '').replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1) + ' SACCO';
}

/**
 * Resolves saccoId for a user, respecting dev mode fallback if SHOW_DEV_TOOLS is active.
 * In production (!SHOW_DEV_TOOLS), returns undefined if user has no saccoId.
 */
export function getEffectiveSaccoId(saccoId?: string | null): string | undefined {
  if (saccoId) return saccoId;
  if (SHOW_DEV_TOOLS) return 'sacco_metrolink';
  return undefined;
}
