#!/usr/bin/env node
/**
 * Headless Chrome WebGL Runner for All 56 GLB Models
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 8991;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

let chromeProc = null;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/report') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));

      try {
        const report = JSON.parse(body);
        console.log('\n======================================================================');
        console.log('  BROWSER WEBGL REPORT RECEIVED');
        console.log('======================================================================');
        console.log(`Passed: ${report.passCount} / 56`);
        console.log(`Failed: ${report.failCount} / 56`);
        console.log('======================================================================\n');

        if (chromeProc) {
          chromeProc.kill('SIGTERM');
        }
        server.close(() => {
          process.exit(report.passed ? 0 : 1);
        });
      } catch (err) {
        console.error('Failed to parse report body:', err);
        if (chromeProc) chromeProc.kill();
        server.close(() => process.exit(1));
      }
    });
    return;
  }

  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/tests/webgl_browser_stress.html';

  const fullPath = path.resolve(process.cwd(), '.' + reqPath);
  if (!fs.existsSync(fullPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + reqPath);
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Test HTTP server listening on http://127.0.0.1:${PORT}`);
  const testUrl = `http://127.0.0.1:${PORT}/tests/webgl_browser_stress.html`;

  console.log('Launching headless Chrome to render 56 models in real WebGL...');
  const chromeArgs = [
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=metal',
    '--enable-unsafe-webgpu',
    '--no-sandbox',
    '--enable-logging=stderr',
    '--v=1',
    testUrl,
  ];

  chromeProc = spawn(CHROME_PATH, chromeArgs);

  // Set timeout guard (60 seconds)
  const timer = setTimeout(() => {
    console.error('\x1b[31mTimeout: Browser WebGL test did not complete within 60s\x1b[0m');
    if (chromeProc) chromeProc.kill();
    server.close(() => process.exit(1));
  }, 60000);

  chromeProc.on('close', (code) => {
    clearTimeout(timer);
    // If Chrome closed prematurely before posting report
    setTimeout(() => {
      server.close();
      console.log('Chrome process exited with code', code);
    }, 500);
  });
});
