import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { resolve } from 'node:path';
const socket = createServer();
await new Promise((done) => socket.listen(0, '127.0.0.1', done));
const port = socket.address().port;
await new Promise((done) => socket.close(done));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['standalone/server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: '0.0.0.0',
    PORT: String(port),
    PUBLIC_ORIGIN: process.argv.includes('--render') ? '' : base,
    RENDER_EXTERNAL_URL: process.argv.includes('--render') ? base : '',
    ASSET_DIR: resolve('standalone/client'),
    SITE_ACCESS_MODE: process.argv.includes('--private') ? 'private' : 'public-byok',
    SITE_PASSWORD: 'synthetic-test-password',
    OPENAI_API_KEY: process.argv.includes('--private')
      ? ''
      : 'synthetic-owner-key-not-for-public-use',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stderr.on('data', (chunk) => {
  output += chunk;
});
try {
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Standalone server startup timed out')), 10000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('ord. →')) {
        clearTimeout(timer);
        done();
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${output}`));
    });
  });
  const get = (path, headers = {}, body = undefined) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(
        base + path,
        { headers, method: body === undefined ? 'GET' : 'POST' },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              text: async () => body,
              json: async () => JSON.parse(body),
            }),
          );
        },
      );
      req.on('error', reject);
      req.end(body);
    });
  assert.equal((await get('/healthz')).status, 200);
  if (process.argv.includes('--private')) {
    assert.match(await (await get('/')).text(), /网站访问密码/);
    assert.equal((await get('/api/ai/status')).status, 401);
    const formHeaders = { origin: base, 'content-type': 'application/x-www-form-urlencoded' };
    assert.equal(
      (
        await get(
          '/login',
          { ...formHeaders, origin: 'https://other.example.com' },
          'username=ord&password=synthetic-test-password',
        )
      ).status,
      403,
    );
    assert.equal((await get('/login', formHeaders, 'username=ord&password=wrong')).status, 401);
    const login = await get('/login', formHeaders, 'username=ord&password=synthetic-test-password');
    assert.equal(login.status, 303);
    const cookie = login.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const session = cookie.split(';')[0];
    assert.match(await (await get('/', { cookie: session })).text(), /<div id="root">/);
    assert.equal((await get('/api/ai/status', { cookie: session })).status, 200);
    assert.equal((await get('/api/ai/status', { cookie: session + 'tampered' })).status, 401);
  } else {
    assert.match(await (await get('/')).text(), /<div id="root">/);
    const status = await (await get('/api/ai/status')).json();
    assert.equal(status.byokOnly, true);
    assert.equal(status.configured, false);
    const generation = { topic: 'synthetic', sfiLevel: 'B', count: 5, consent: true };
    const response = await get(
      '/api/ai/generate',
      { origin: base, 'content-type': 'application/json' },
      JSON.stringify(generation),
    );
    assert.equal(response.status, 401);
  }
  const headers = {};
  if (process.argv.includes('--private')) {
    const login = await get(
      '/login',
      { origin: base, 'content-type': 'application/x-www-form-urlencoded' },
      'username=ord&password=synthetic-test-password',
    );
    headers.cookie = login.headers['set-cookie'][0].split(';')[0];
  }
  const page = await get('/', headers);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root">/);
  const status = await get('/api/ai/status', headers);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).configured, false);
  for (const path of ['/.env.local', '/server.mjs', '/server/index.js', '/package.json']) {
    assert.equal((await get(path, headers)).status, 404);
  }
  assert.equal(
    (await get('/api/ai/status', { ...headers, host: 'wrong.example.com' })).status,
    403,
  );

  console.log(
    'Standalone checks passed: website, health, public BYOK/private access, AI status, host checks, and private file isolation.',
  );
} finally {
  child.kill('SIGTERM');
  if (child.exitCode === null) await new Promise((done) => child.once('exit', done));
}
