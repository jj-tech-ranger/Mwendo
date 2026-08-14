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
  };
});
