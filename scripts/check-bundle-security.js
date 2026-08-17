import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ dist/ directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

const FORBIDDEN_PATTERNS = [
  '__setTestAuth',
  '__TEST_AUTH_OVERRIDE__',
  '__INITIAL_TEST_ROLE__',
  '__INITIAL_TEST_SACCO__',
  'testAuthHarness',
];

function getFilesRecursively(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getFilesRecursively(DIST_DIR);
let violationsCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (content.includes(pattern)) {
      console.error(`❌ Security Violation: Found "${pattern}" in production bundle file: ${path.relative(process.cwd(), file)}`);
      violationsCount++;
    }
  }
}

if (violationsCount > 0) {
  console.error(`\n🚨 Found ${violationsCount} security violation(s) in production build assets!`);
  process.exit(1);
}

console.log('✅ Bundle security audit passed: Zero test-auth symbols or harnesses found in production build.');
process.exit(0);
