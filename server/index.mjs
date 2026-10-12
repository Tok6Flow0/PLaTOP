import http from 'node:http';
import path from 'node:path';
import { readFile, realpath, stat, lstat } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore, ensureToken } from './store.mjs';
import { MAX_BODY_BYTES, parseUpdates } from './protocol.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.mp4': 'video/mp4' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};

function sendJSON(response, status, payload) {
  response.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function safePath(rawURL) {
  const raw = rawURL.split('?')[0];
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.split('/').some(segment => segment === '..' || segment === '.')) throw new Error('Invalid path.');
  return decoded;
}

async function readJSON(request) {
  const contentType = request.headers['content-type']?.split(';')[0].trim();
  if (contentType !== 'application/json' || request.headers['content-encoding']) throw Object.assign(new Error(), { status: 415 });
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw Object.assign(new Error(), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error(), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error(), { status: 400 }); }
}

function authorized(header, token) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const candidate = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createBridge({ root = ROOT, port = 4317, now = Date.now, ttlMs, heartbeatMs = 25_000, expiryCheckMs = 5000 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid local port.');
  const canonicalRoot = await realpath(root);
  const localDirectory = path.join(canonicalRoot, '.local');
  const token = await ensureToken(localDirectory);
  const store = await createStore({ localDirectory, now, ttlMs });
  const clients = new Set();
  let boundPort;
  let distDirectory;
  const findDist = async () => {
    const directory = path.join(canonicalRoot, 'dist');
    if ((await lstat(directory)).isSymbolicLink()) throw new Error('Build directory must not be a symlink.');
    return realpath(directory);
  };
  try { distDirectory = await findDist(); } catch { /* Build can be created after server startup. */ }
  const emit = snapshot => {
    const message = `event: state\ndata: ${JSON.stringify(snapshot)}\n\n`;
    for (const client of clients) {
      if (client.writableLength > 65_536) { client.destroy(); clients.delete(client); }
      else client.write(message);
    }
  };
  const server = http.createServer(async (request, response) => {
    try {
      const allowedHosts = [`127.0.0.1:${boundPort}`, `localhost:${boundPort}`];
      if (!allowedHosts.includes(request.headers.host)) return sendJSON(response, 403, { error: 'Local access only.' });
      if (request.headers.origin && !allowedHosts.map(host => `http://${host}`).includes(request.headers.origin)) return sendJSON(response, 403, { error: 'Local origin required.' });
      let pathname;
      try { pathname = safePath(request.url ?? '/'); } catch { return sendJSON(response, 400, { error: 'Invalid path.' }); }
      if (pathname === '/api/state' && request.method === 'GET') return sendJSON(response, 200, store.snapshot());
      if (pathname === '/api/events' && request.method === 'GET') {
        if (clients.size >= 12) return sendJSON(response, 503, { error: 'Local connection limit reached.' });
        response.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        response.write('retry: 5000\n\n');
        clients.add(response);
        response.write(`event: state\ndata: ${JSON.stringify(store.snapshot())}\n\n`);
        request.on('close', () => clients.delete(response));
        return;
      }
      if (pathname === '/api/events' && request.method === 'POST') {
        if (!authorized(request.headers.authorization, token)) return sendJSON(response, 401, { error: 'Local token required.' });
        let updates;
        try { updates = parseUpdates(await readJSON(request)); } catch (error) {
          return sendJSON(response, error.status ?? 400, { error: 'Invalid public activity update.' });
        }
        const snapshot = await store.update(updates);
        emit(snapshot);
        return sendJSON(response, 200, snapshot);
      }
      if (pathname.startsWith('/api/')) return sendJSON(response, 404, { error: 'Unknown local endpoint.' });
      if (!['GET', 'HEAD'].includes(request.method)) return sendJSON(response, 405, { error: 'Method not allowed.' });
      try {
        distDirectory ??= await findDist();
        const candidate = path.resolve(distDirectory, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!candidate.startsWith(`${distDirectory}${path.sep}`)) throw new Error();
        let file;
        try { file = await realpath(candidate); } catch {
          if (path.extname(pathname)) throw new Error();
          file = await realpath(path.join(distDirectory, 'index.html'));
        }
        if (!file.startsWith(`${distDirectory}${path.sep}`) || !(await stat(file)).isFile()) throw new Error();
        const body = await readFile(file);
        response.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
        response.end(request.method === 'HEAD' ? undefined : body);
      } catch { sendJSON(response, 404, { error: 'Build file not found. Run npm run build.' }); }
    } catch { if (!response.headersSent) sendJSON(response, 500, { error: 'Local bridge unavailable.' }); else response.destroy(); }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 32;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { boundPort = server.address().port; resolve(); });
  });
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (client.writableLength > 65_536) { client.destroy(); clients.delete(client); }
      else client.write(': heartbeat\n\n');
    }
  }, heartbeatMs);
  const expiry = setInterval(() => { if (store.expire()) emit(store.snapshot()); }, expiryCheckMs);
  heartbeat.unref(); expiry.unref();
  return {
    port: boundPort,
    close: async () => {
      clearInterval(heartbeat); clearInterval(expiry);
      clients.forEach(client => client.destroy()); clients.clear();
      await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); });
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PLATOP_PORT ? Number(process.env.PLATOP_PORT) : 4317;
  createBridge({ port }).then(bridge => {
    console.log(`PLaTOP local playground: http://127.0.0.1:${bridge.port}`);
    const shutdown = () => bridge.close().then(() => process.exit(0));
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  }).catch(() => { console.error('PLaTOP could not start. Check the local port and .local file permissions.'); process.exitCode = 1; });
}
