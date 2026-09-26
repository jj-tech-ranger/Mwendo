#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

/**
 * Strips the leading top-level comment block (such as file docstrings)
 * so that differing module descriptions/headers do not trigger false positives,
 * while ensuring that all logic, types, exports, and implementation details
 * remain byte-identical.
 */
function normalizeEngineSource(source: string): string {
  // Normalize CRLF to LF
  const normalized = source.replace(/\r\n/g, '\n').trim();

  // Strip leading block comments: /** ... */ or /* ... */
  const withoutLeadingComment = normalized.replace(/^\/\*[\s\S]*?\*\/\s*/, '');

  return withoutLeadingComment.trim();
}

function verifyEngineParity(): void {
  const rootDir = process.cwd();
  const clientEnginePath = path.resolve(rootDir, 'src/lib/engine.ts');
  const serverEnginePath = path.resolve(rootDir, 'apps/functions/src/lib/engine.ts');

  if (!fs.existsSync(clientEnginePath)) {
    console.error(`[verify-engine-parity] ERROR: Client engine not found at ${clientEnginePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(serverEnginePath)) {
    console.error(`[verify-engine-parity] ERROR: Server engine not found at ${serverEnginePath}`);
    process.exit(1);
  }

  const clientContent = fs.readFileSync(clientEnginePath, 'utf8');
  const serverContent = fs.readFileSync(serverEnginePath, 'utf8');

  const normalizedClient = normalizeEngineSource(clientContent);
  const normalizedServer = normalizeEngineSource(serverContent);

  if (normalizedClient !== normalizedServer) {
    console.error('❌ [verify-engine-parity] ENGINE PARITY VIOLATION DETECTED!');
    console.error('src/lib/engine.ts and apps/functions/src/lib/engine.ts have diverged.');

    const clientLines = normalizedClient.split('\n');
    const serverLines = normalizedServer.split('\n');
    const maxLines = Math.max(clientLines.length, serverLines.length);

    console.error('\nDiff details:');
    let diffCount = 0;
    for (let i = 0; i < maxLines && diffCount < 10; i++) {
      const cLine = clientLines[i] ?? '<EOF>';
      const sLine = serverLines[i] ?? '<EOF>';
      if (cLine !== sLine) {
        console.error(`Line ${i + 1}:`);
        console.error(`  - Client: ${cLine}`);
        console.error(`  + Server: ${sLine}`);
        diffCount++;
      }
    }

    if (diffCount >= 10) {
      console.error('  ... (more diffs omitted)');
    }

    console.error('\nPlease synchronize both engine.ts files identically before committing.');
    process.exit(1);
  }

  console.log('✅ [verify-engine-parity] PARITY VERIFIED: Client and server engine.ts are in sync.');
}

verifyEngineParity();
