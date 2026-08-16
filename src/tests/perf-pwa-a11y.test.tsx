// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PERF-005 / PERF-006 / A11Y-004 / PWA-003 Suite Verification', () => {
  it('PWA-003: manifest.json includes dedicated maskable and standard icons, and index.html includes 180x180 PNG apple-touch-icon', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    const maskableIcon = manifest.icons.find((i: { purpose: string; src: string }) => i.purpose === 'maskable');
    const anyIcon = manifest.icons.find((i: { purpose: string; src: string }) => i.purpose === 'any');

    expect(maskableIcon).toBeDefined();
    expect(anyIcon).toBeDefined();
    expect(maskableIcon.src).toMatch(/icon-maskable/);

    // Verify PNG files exist on disk
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/apple-touch-icon.png'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/icon-maskable-512.png'))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), 'public/icon-512.png'))).toBe(true);

    // Verify index.html uses PNG apple-touch-icon
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');
    expect(indexHtml).toContain('rel="apple-touch-icon"');
    expect(indexHtml).toContain('apple-touch-icon.png');
    expect(indexHtml).not.toContain('apple-touch-icon" href="/icon.svg"');
  });

  it('A11Y-004: index.css includes prefers-reduced-motion media query disabling indefinite animations', () => {
    const cssPath = path.resolve(process.cwd(), 'src/index.css');
    const indexCss = fs.readFileSync(cssPath, 'utf-8');

    expect(indexCss).toContain('prefers-reduced-motion: reduce');
    expect(indexCss).toContain('.animate-pulse');
    expect(indexCss).toContain('.animate-ping');
    expect(indexCss).toContain('.animate-bounce');
    expect(indexCss).toContain('animation: none');
  });

  it('PERF-005: AuthorityDashboard and AuthorityReportsScreen compute analytical datasets via useMemo', () => {
    const dashPath = path.resolve(process.cwd(), 'src/features/authority/AuthorityDashboard.tsx');
    const dashCode = fs.readFileSync(dashPath, 'utf-8');
    expect(dashCode).toContain('const speedTrendData = useMemo(');
    expect(dashCode).toContain('const countyViolationData = useMemo(');

    const reportsPath = path.resolve(process.cwd(), 'src/features/authority/AuthorityReportsScreen.tsx');
    const reportsCode = fs.readFileSync(reportsPath, 'utf-8');
    expect(reportsCode).toContain('const saccoComplianceData = useMemo(');
    expect(reportsCode).toContain('const speedTrendData = useMemo(');
    expect(reportsCode).toContain('const hazardBreakdownData = useMemo(');
  });
});
