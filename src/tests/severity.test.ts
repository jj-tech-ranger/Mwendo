import { describe, it, expect } from 'vitest';
import {
  severityToBadgeVariant,
  getSeverityBadgeVariant,
  riskTierToBadgeVariant,
} from '../lib/severity';
import { SeverityLevel } from '../types';

describe('severityToBadgeVariant unit tests (UI-015: Canonical Severity Mapping)', () => {
  it('maps "critical" severity to "danger"', () => {
    expect(severityToBadgeVariant('critical')).toBe('danger');
    expect(severityToBadgeVariant('CRITICAL' as SeverityLevel)).toBe('danger');
    expect(getSeverityBadgeVariant('critical')).toBe('danger');
  });

  it('maps "high" severity to "danger"', () => {
    expect(severityToBadgeVariant('high')).toBe('danger');
    expect(severityToBadgeVariant('HIGH' as SeverityLevel)).toBe('danger');
  });

  it('maps "medium" and "moderate" severity/riskTier to "warning"', () => {
    expect(severityToBadgeVariant('medium')).toBe('warning');
    expect(severityToBadgeVariant('MEDIUM' as SeverityLevel)).toBe('warning');
    expect(severityToBadgeVariant('moderate')).toBe('warning');
  });

  it('maps "low" severity to "info" by default', () => {
    expect(severityToBadgeVariant('low')).toBe('info');
    expect(severityToBadgeVariant('LOW' as SeverityLevel)).toBe('info');
  });

  it('maps "low" to "success" when lowVariant is configured', () => {
    expect(severityToBadgeVariant('low', { lowVariant: 'success' })).toBe('success');
  });

  it('maps risk tiers correctly via riskTierToBadgeVariant', () => {
    expect(riskTierToBadgeVariant('low')).toBe('success');
    expect(riskTierToBadgeVariant('Low Risk')).toBe('success');
    expect(riskTierToBadgeVariant('medium')).toBe('warning');
    expect(riskTierToBadgeVariant('moderate')).toBe('warning');
    expect(riskTierToBadgeVariant('Moderate Risk')).toBe('warning');
    expect(riskTierToBadgeVariant('high')).toBe('danger');
    expect(riskTierToBadgeVariant('High Risk')).toBe('danger');
    expect(riskTierToBadgeVariant('critical')).toBe('danger');
    expect(riskTierToBadgeVariant('Critical Risk')).toBe('danger');
    expect(riskTierToBadgeVariant('unknown' as any)).toBe('neutral');
  });

  it('provides an explicit, visually distinct "neutral" fallback for unrecognized/unknown values', () => {
    expect(severityToBadgeVariant('unknown')).toBe('neutral');
    expect(severityToBadgeVariant('invalid_tier')).toBe('neutral');
    expect(severityToBadgeVariant('catastrophic')).toBe('neutral');
    expect(severityToBadgeVariant('')).toBe('neutral');
    expect(severityToBadgeVariant(null)).toBe('neutral');
    expect(severityToBadgeVariant(undefined)).toBe('neutral');
  });
});
