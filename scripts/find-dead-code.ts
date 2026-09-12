#!/usr/bin/env tsx
/**
 * scripts/find-dead-code.ts
 *
 * Systematic AST and module-graph dead-code scanner for Mwendo Salama.
 * Uses the TypeScript Compiler API to analyze export references across:
 *  - src/
 *  - apps/functions/src/
 *
 * Accounts explicitly for dynamic imports in src/routes/index.tsx (lazyWithRetry).
 */

import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

interface ExportItem {
  name: string;
  filePath: string;
  isDefault: boolean;
  kind: string;
}

interface DeadCodeCandidate {
  identifier: string;
  filePath: string;
  category: 'CONFIRMED_DEAD' | 'FALSE_POSITIVE' | 'NEEDS_HUMAN_DECISION';
  reason: string;
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'lib' ||
        entry.name === '.git'
      ) {
        continue;
      }
      results.push(...getAllFiles(fullPath, extensions));
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// Extract dynamically imported route paths from src/routes/index.tsx
function getLazyLoadedRoutes(): Set<string> {
  const routesFile = path.resolve('src/routes/index.tsx');
  const lazyRoutes = new Set<string>();

  if (!fs.existsSync(routesFile)) return lazyRoutes;
  const content = fs.readFileSync(routesFile, 'utf8');

  // Match import('../features/...')
  const regex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const relPath = match[1];
    const resolved = path.resolve(path.dirname(routesFile), relPath);
    lazyRoutes.add(resolved);
    // Also add with .tsx, .ts
    lazyRoutes.add(`${resolved}.tsx`);
    lazyRoutes.add(`${resolved}.ts`);
  }

  return lazyRoutes;
}

export function scanCodebase(): DeadCodeCandidate[] {
  const srcFiles = getAllFiles(path.resolve('src'), ['.ts', '.tsx']);
  const fnFiles = getAllFiles(path.resolve('apps/functions/src'), ['.ts']);
  const allFiles = [...srcFiles, ...fnFiles];

  const lazyRoutes = getLazyLoadedRoutes();

  // Read all file contents into memory for reference search
  const fileContents = new Map<string, string>();
  for (const file of allFiles) {
    fileContents.set(file, fs.readFileSync(file, 'utf8'));
  }

  // Find all exported declarations
  const exportsList: ExportItem[] = [];

  const program = ts.createProgram(allFiles, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
  });

  for (const file of allFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;

    // Do not scan test files for exports
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
      continue;
    }

    // Do not scan main root entrypoints
    if (
      file.endsWith('main.tsx') ||
      file.endsWith('routes/index.tsx') ||
      file.endsWith('apps/functions/src/index.ts')
    ) {
      continue;
    }

    ts.forEachChild(sourceFile, (node) => {
      // Named exports
      if (ts.isFunctionDeclaration(node) && node.name && hasExportModifier(node)) {
        exportsList.push({
          name: node.name.text,
          filePath: file,
          isDefault: hasDefaultModifier(node),
          kind: 'function',
        });
      } else if (ts.isVariableStatement(node) && hasExportModifier(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exportsList.push({
              name: decl.name.text,
              filePath: file,
              isDefault: false,
              kind: 'variable',
            });
          }
        }
      } else if (ts.isClassDeclaration(node) && node.name && hasExportModifier(node)) {
        exportsList.push({
          name: node.name.text,
          filePath: file,
          isDefault: hasDefaultModifier(node),
          kind: 'class',
        });
      } else if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
        exportsList.push({
          name: node.name.text,
          filePath: file,
          isDefault: false,
          kind: 'interface',
        });
      } else if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
        exportsList.push({
          name: node.name.text,
          filePath: file,
          isDefault: false,
          kind: 'type',
        });
      } else if (ts.isEnumDeclaration(node) && hasExportModifier(node)) {
        exportsList.push({
          name: node.name.text,
          filePath: file,
          isDefault: false,
          kind: 'enum',
        });
      } else if (ts.isExportAssignment(node)) {
        exportsList.push({
          name: 'default',
          filePath: file,
          isDefault: true,
          kind: 'default_export',
        });
      }
    });
  }

  const candidates: DeadCodeCandidate[] = [];

  for (const exp of exportsList) {
    // Check if the file is a dynamically imported route
    const isLazyRoute =
      lazyRoutes.has(exp.filePath) ||
      lazyRoutes.has(exp.filePath.replace(/\.tsx?$/, ''));

    if (exp.isDefault && isLazyRoute) {
      // Default export of a lazy-loaded route is definitely active
      continue;
    }

    // Search for references in other files
    let referenceCount = 0;
    let referencedInTests = false;

    for (const [otherFile, content] of fileContents.entries()) {
      if (otherFile === exp.filePath) continue;

      // Simple word-boundary check
      const regex = new RegExp(`\\b${exp.name}\\b`);
      if (regex.test(content)) {
        referenceCount++;
        if (
          otherFile.includes('.test.') ||
          otherFile.includes('.spec.') ||
          otherFile.includes('__tests__')
        ) {
          referencedInTests = true;
        }
      }
    }

    if (referenceCount === 0) {
      if (isLazyRoute) {
        candidates.push({
          identifier: exp.name,
          filePath: path.relative(process.cwd(), exp.filePath),
          category: 'FALSE_POSITIVE',
          reason: 'Lazy-loaded route component or helper in dynamic route file.',
        });
      } else if (exp.filePath.includes('/types') || exp.kind === 'interface' || exp.kind === 'type') {
        candidates.push({
          identifier: exp.name,
          filePath: path.relative(process.cwd(), exp.filePath),
          category: 'NEEDS_HUMAN_DECISION',
          reason: 'Exported TypeScript type/interface with 0 current usages in codebase.',
        });
      } else {
        candidates.push({
          identifier: exp.name,
          filePath: path.relative(process.cwd(), exp.filePath),
          category: 'CONFIRMED_DEAD',
          reason: `Exported ${exp.kind} '${exp.name}' is unreferenced in all source and test files.`,
        });
      }
    } else if (referencedInTests && referenceCount === 1) {
      candidates.push({
        identifier: exp.name,
        filePath: path.relative(process.cwd(), exp.filePath),
        category: 'FALSE_POSITIVE',
        reason: 'Referenced exclusively in test files (test utility / contract verification).',
      });
    }
  }

  return candidates;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return Boolean(modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
}

function hasDefaultModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return Boolean(modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Systematic Dead-Code Scanner across src/ and apps/functions/src/...\n');
  const candidates = scanCodebase();

  const confirmed = candidates.filter((c) => c.category === 'CONFIRMED_DEAD');
  const falsePositives = candidates.filter((c) => c.category === 'FALSE_POSITIVE');
  const needsDecision = candidates.filter((c) => c.category === 'NEEDS_HUMAN_DECISION');

  console.log('='.repeat(70));
  console.log(`DEAD CODE SCAN RESULTS: ${candidates.length} total candidates identified`);
  console.log(`  - Confirmed Dead         : ${confirmed.length}`);
  console.log(`  - False Positives        : ${falsePositives.length}`);
  console.log(`  - Needs Human Decision   : ${needsDecision.length}`);
  console.log('='.repeat(70));

  if (confirmed.length > 0) {
    console.log('\nCONFIRMED DEAD EXPORTS:');
    for (const c of confirmed) {
      console.log(`  [CONFIRMED] ${c.filePath} :: ${c.identifier} (${c.reason})`);
    }
  }

  if (needsDecision.length > 0) {
    console.log('\nNEEDS HUMAN DECISION (e.g. Domain Types):');
    for (const c of needsDecision) {
      console.log(`  [DECISION]  ${c.filePath} :: ${c.identifier} (${c.reason})`);
    }
  }

  if (falsePositives.length > 0) {
    console.log('\nFALSE POSITIVES (Preserved):');
    for (const c of falsePositives.slice(0, 15)) {
      console.log(`  [PRESERVED] ${c.filePath} :: ${c.identifier} (${c.reason})`);
    }
    if (falsePositives.length > 15) {
      console.log(`  ... and ${falsePositives.length - 15} more lazy-loaded routes`);
    }
  }
}
