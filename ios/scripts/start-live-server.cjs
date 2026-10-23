// Local development connection for the iOS simulator. Credentials stay on this Mac.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const state = '/tmp/finance-live-preview';
fs.mkdirSync(state, { recursive: true, mode: 0o700 });
fs.chmodSync(state, 0o700);
const keyPath = path.join(state, 'device-key');
if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('base64url'), { mode: 0o600 });
const key = fs.readFileSync(keyPath, 'utf8');

const backend = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '4341'], {
  cwd: root,
  env: { ...process.env, NATIVE_TOKEN_SHA256: crypto.createHash('sha256').update(key).digest('hex'), NEXT_BUILD_DIR: '.next-native-live' },
  stdio: ['ignore', 'inherit', 'inherit'],
});

function handler(request, response) {
  const url = new URL(request.url, 'http://localhost:4340');
  const allowed = request.method === 'GET'
    ? ['/api/native/snapshot', '/api/native/resources'].includes(url.pathname)
    : request.method === 'POST' && (
      ['/api/native/operations', '/api/native/assistant'].includes(url.pathname)
      || (url.pathname === '/api/native/resources' && url.searchParams.get('kind') === 'sync')
    );
  if (!allowed) {
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Unknown native endpoint.' }));
    return;
  }
  const upstream = http.request({
    host: '127.0.0.1', port: 4341, path: url.pathname + url.search, method: request.method,
    headers: {
      authorization: request.headers.authorization || '',
      accept: 'application/json', 'content-type': 'application/json',
      ...(request.headers.origin ? { origin: request.headers.origin } : {}),
    },
  }, incoming => {
    response.writeHead(incoming.statusCode, {
      'Content-Type': incoming.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store',
    });
    incoming.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Local finance server is unavailable.' }));
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
}

const servers = ['127.0.0.1', '::1'].map(host => http.createServer(handler).listen(4340, host));
function stop() {
  servers.forEach(server => server.close());
  backend.kill('SIGTERM');
  process.exit();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
backend.on('exit', code => { servers.forEach(server => server.close()); process.exit(code || 0); });
console.log('Native finance server: http://localhost:4340. Saves update the live Notion ledger.');
