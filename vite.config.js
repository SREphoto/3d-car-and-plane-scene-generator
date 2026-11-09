import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const ASSETS_ROOT = path.resolve(process.cwd(), '3D Car and Plane Scene Creator');

const MIME_MAP = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.json': 'application/json',
};

function serveWorkspaceAssetsPlugin() {
  const attachMiddleware = (middlewares) => {
    middlewares.use('/assets', (req, res, next) => {
      try {
        const cleanUrl = decodeURIComponent((req.url || '/').split('?')[0]);
        const filePath = path.join(ASSETS_ROOT, cleanUrl);
        if (!filePath.startsWith(ASSETS_ROOT)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_MAP[ext] || 'application/octet-stream';

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunkSize = end - start + 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': chunkSize,
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': stat.size,
          });
          fs.createReadStream(filePath).pipe(res);
        }
      } catch (err) {
        next(err);
      }
    });
  };

  return {
    name: 'serve-workspace-assets',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
    closeBundle() {
      // Copy needed GLB models and MP3 soundtracks to dist/assets during build
      const outDir = path.resolve(process.cwd(), 'dist', 'assets');
      console.log('\n[build] Copying GLBs and MP3s to dist/assets for GitHub Pages...');

      function copyRecursive(src, dst, filter) {
        if (!fs.existsSync(src)) return;
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
          fs.readdirSync(src).forEach((child) => {
            copyRecursive(path.join(src, child), path.join(dst, child), filter);
          });
        } else if (filter(src)) {
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.copyFileSync(src, dst);
        }
      }

      // 1. Cars .glb files
      copyRecursive(
        path.join(ASSETS_ROOT, 'Cars'),
        path.join(outDir, 'Cars'),
        (p) => p.endsWith('.glb')
      );

      // 2. Planes .glb files
      copyRecursive(
        path.join(ASSETS_ROOT, 'Planes'),
        path.join(outDir, 'Planes'),
        (p) => p.endsWith('.glb')
      );

      // 3. Locations .glb files
      copyRecursive(
        path.join(ASSETS_ROOT, 'Locations'),
        path.join(outDir, 'Locations'),
        (p) => p.endsWith('.glb')
      );

      // 4. Music .mp3 files
      copyRecursive(
        path.join(ASSETS_ROOT, 'Music'),
        path.join(outDir, 'Music'),
        (p) => p.endsWith('.mp3')
      );

      console.log('[build] Assets copy complete!\n');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serveWorkspaceAssetsPlugin()],
  server: {
    host: true,
    port: 5173,
  },
});
