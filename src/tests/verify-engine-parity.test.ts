import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Engine Parity Automated Guard', () => {
  const rootDir = process.cwd();
  const clientEnginePath = path.resolve(rootDir, 'src/lib/engine.ts');
  const serverEnginePath = path.resolve(rootDir, 'apps/functions/src/lib/engine.ts');

  it('client and server engine.ts exist', () => {
    expect(fs.existsSync(clientEnginePath)).toBe(true);
    expect(fs.existsSync(serverEnginePath)).toBe(true);
  });

  it('executes scripts/verify-engine-parity.ts successfully with code 0', () => {
    const output = execSync('npx tsx scripts/verify-engine-parity.ts', {
      encoding: 'utf8',
    });
    expect(output).toContain('PARITY VERIFIED');
  });

  it('detects and fails on deliberate logic mismatch', () => {
    const originalServerContent = fs.readFileSync(serverEnginePath, 'utf8');
    try {
      fs.writeFileSync(
        serverEnginePath,
        originalServerContent + '\n// DELIBERATE_PARITY_TEST_MISMATCH\n',
        'utf8'
      );
      expect(() => {
        execSync('npx tsx scripts/verify-engine-parity.ts', {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      }).toThrow();
    } finally {
      fs.writeFileSync(serverEnginePath, originalServerContent, 'utf8');
    }
  });
});
