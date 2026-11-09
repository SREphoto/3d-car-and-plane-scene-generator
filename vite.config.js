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
