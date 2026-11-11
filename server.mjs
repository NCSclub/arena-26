import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { Readable } from 'node:stream';
import registrations from './api/registrations.js';
import session from './api/admin/session.js';
import adminRegistrations from './api/admin/registrations.js';
import exportRegistrations from './api/admin/export.js';
import submissions from './api/submissions.js';
import adminSubmissions from './api/admin/submissions.js';
import adminSettings from './api/admin/settings.js';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const routes = { '/api/registrations': registrations, '/api/submissions': submissions, '/api/admin/session': session, '/api/admin/registrations': adminRegistrations, '/api/admin/submissions': adminSubmissions, '/api/admin/settings': adminSettings,'/api/admin/export': exportRegistrations };
const pages = { '/': '/index.html', '/admin': '/admin.html', '/submit': '/submit.html' };
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const port = Number(process.env.PORT || 4173);
if (process.argv.includes('--local-dev') && !process.env.VERCEL) process.env.ARENA_LOCAL_DEV = 'true';
process.env.PORT = String(port);
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`), pathname = decodeURIComponent(url.pathname);
    if (routes[pathname]) {
      const webRequest = new Request(url, { method: request.method, headers: request.headers, ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Readable.toWeb(request), duplex: 'half' }) });
      const result = await routes[pathname].fetch(webRequest);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      if (result.body) Readable.fromWeb(result.body).on('error', () => response.destroy()).pipe(response);
      else response.end();
      return;
    }
    const file = resolve(root, '.' + (pages[pathname] ?? pathname));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403).end();return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`ARENA — http://127.0.0.1:${port}`));
