import fs from 'node:fs';
import path from 'node:path';

/**
 * SEC-001 CI Quality Gate:
 * Verifies that storage.rules cross-service Firestore lookups use '(default)',
 * and that project/runtime configuration expects the '(default)' Firestore database.
 *
 * If a custom database ID is ever configured without updating Storage rules,
 * evidence verification lookups (exists(/databases/(default)/...)) fail closed.
 */

const STORAGE_RULES_PATH = path.resolve(process.cwd(), 'storage.rules');

if (!fs.existsSync(STORAGE_RULES_PATH)) {
  console.error('❌ SEC-001 Violation: storage.rules file not found.');
  process.exit(1);
}

const storageRulesContent = fs.readFileSync(STORAGE_RULES_PATH, 'utf8');

// Match any /databases/<id>/ pattern in storage.rules
const databaseMatches = [...storageRulesContent.matchAll(/\/databases\/([^/]+)\//g)];

if (databaseMatches.length === 0) {
  console.error('❌ SEC-001 Violation: Expected cross-service Firestore references in storage.rules, but found none.');
  process.exit(1);
}

for (const match of databaseMatches) {
  const dbId = match[1];
  if (dbId !== '(default)') {
    console.error(`❌ SEC-001 Critical Failure: storage.rules contains non-default database reference "/databases/${dbId}/". Only "(default)" is supported.`);
    process.exit(1);
  }
}

// Verify configured environment variables if set
const envDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID;
if (envDatabaseId && envDatabaseId.trim() !== '(default)') {
  console.error(`❌ SEC-001 Critical Failure: Runtime database ID is configured as "${envDatabaseId}", but storage.rules cross-references require "(default)".`);
  process.exit(1);
}

console.log(`✅ SEC-001 Check Passed: Verified ${databaseMatches.length} storage.rules cross-service references target "(default)" database and environment configuration is compliant.`);
process.exit(0);
