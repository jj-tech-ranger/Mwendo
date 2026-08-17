import { describe, it, expect } from 'vitest';
import { en } from '../locales/en';
import { sw } from '../locales/sw';

function getDeepKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getDeepKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('I18N-001: Locale Key Parity (en vs sw)', () => {
  it('en.ts and sw.ts have exact 1:1 key parity depth-first', () => {
    const enKeys = getDeepKeys(en);
    const swKeys = getDeepKeys(sw);

    const missingInSw = enKeys.filter((k) => !swKeys.includes(k));
    const missingInEn = swKeys.filter((k) => !enKeys.includes(k));

    if (missingInSw.length > 0) {
      console.error('Keys present in en.ts but missing in sw.ts:', missingInSw);
    }
    if (missingInEn.length > 0) {
      console.error('Keys present in sw.ts but missing in en.ts:', missingInEn);
    }

    expect(missingInSw).toEqual([]);
    expect(missingInEn).toEqual([]);
    expect(enKeys).toEqual(swKeys);
  });

  it('all translation values in en.ts and sw.ts are non-empty strings', () => {
    function assertNoEmptyValues(obj: Record<string, any>, prefix = '', localeName: string) {
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const val = obj[key];
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          assertNoEmptyValues(val, fullKey, localeName);
        } else {
          expect(typeof val).toBe('string');
          expect((val as string).trim().length, `Empty string at ${localeName}:${fullKey}`).toBeGreaterThan(0);
        }
      }
    }

    assertNoEmptyValues(en, '', 'en');
    assertNoEmptyValues(sw, '', 'sw');
  });
});
