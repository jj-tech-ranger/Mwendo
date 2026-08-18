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
 * Resolves saccoId for a user. Returns undefined if user has no saccoId.
 */
export function getEffectiveSaccoId(saccoId?: string | null): string | undefined {
  return saccoId || undefined;
}

