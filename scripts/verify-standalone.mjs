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
    SITE_PASSWORD: 'synthetic-test-password',
    OPENAI_API_KEY: '',
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
  const get = (path, headers = {}) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(base + path, { headers }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            text: async () => body,
            json: async () => JSON.parse(body),
          }),
        );
      });
      req.on('error', reject);
      req.end();
    });
  assert.equal((await get('/healthz')).status, 200);
  assert.equal((await get('/')).status, 401);
  assert.equal((await get('/api/ai/status')).status, 401);
  const headers = {
    authorization: `Basic ${Buffer.from('ord:synthetic-test-password').toString('base64')}`,
  };
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
  assert.equal(
    (
      await get('/', {
        authorization: `Basic ${Buffer.from('ord:wrong-password').toString('base64')}`,
      })
    ).status,
    401,
  );
  console.log(
    'Standalone checks passed: website, health, password, AI status, allowed host, private file isolation.',
  );
} finally {
  child.kill('SIGTERM');
  if (child.exitCode === null) await new Promise((done) => child.once('exit', done));
}
