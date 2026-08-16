import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

function swVersionPlugin(): Plugin {
  const getBuildId = () => {
    return process.env.BUILD_ID || `v0.0.0-${Date.now()}`;
  };

  return {
    name: 'sw-version-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sw.js' || req.url?.startsWith('/sw.js?')) {
          try {
            const swPath = path.resolve(__dirname, 'public/sw.js');
            let swContent = fs.readFileSync(swPath, 'utf-8');
            const buildId = getBuildId();
            swContent = swContent.replace(/__BUILD_ID__/g, buildId);
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.end(swContent);
            return;
          } catch (e) {
            next(e);
          }
        }
        next();
      });
    },
    writeBundle() {
      const distSwPath = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(distSwPath)) {
        let swContent = fs.readFileSync(distSwPath, 'utf-8');
        const buildId = getBuildId();
        swContent = swContent.replace(/__BUILD_ID__/g, buildId);
        fs.writeFileSync(distSwPath, swContent, 'utf-8');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), swVersionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**/*.{ts,tsx}',
        'apps/functions/src/**/*.test.{ts,tsx}',
        'apps/functions/src/**/__tests__/**/*.{ts,tsx}',
      ],
      exclude: ['node_modules', 'dist', 'e2e/**', '.idea', '.git', '.cache'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'src/lib/**',
          'apps/functions/src/**',
        ],
        exclude: [
          '**/*.test.{ts,tsx}',
          '**/__tests__/**',
          '**/*.d.ts',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  };
});
