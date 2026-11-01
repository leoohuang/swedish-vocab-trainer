import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
test('实际构建的公开网站无需密码，严格 CSP 下可填个人 API，站长密钥不可被使用', async ({
  page,
  request,
}) => {
  const socket = createServer();
  await new Promise<void>((done) => socket.listen(0, '127.0.0.1', done));
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const port = address.port;
  await new Promise<void>((done) => socket.close(() => done()));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['standalone/server.mjs'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      PUBLIC_ORIGIN: base,
      SITE_ACCESS_MODE: 'public-byok',
      SITE_PASSWORD: 'synthetic-unused-site-password',
      OPENAI_API_KEY: 'synthetic-owner-key-never-use',
      ASSET_DIR: resolve('standalone/client'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise<void>((done, reject) => {
      const timer = setTimeout(() => reject(new Error('Standalone startup timed out')), 10000);
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes('ord. →')) {
          clearTimeout(timer);
          done();
        }
      });
      child.once('error', reject);
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('Standalone exited early'));
      });
    });
    const response = await page.goto(base);
    expect(response?.headers()['content-security-policy']).toContain("connect-src 'self'");
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Import my words', exact: true })).toBeVisible();
    const status = await request.get(base + '/api/ai/status');
    expect(status.status()).toBe(200);
    expect(await status.json()).toMatchObject({ byokOnly: true, configured: false });
    const denied = await request.post(base + '/api/ai/generate', {
      headers: { Origin: base },
      data: { topic: 'synthetic', sfiLevel: 'B', count: 5, consent: true },
    });
    expect(denied.status()).toBe(401);
    expect(await denied.text()).not.toContain('synthetic-owner-key');
    await page.getByRole('button', { name: 'Data & settings', exact: true }).click();
    await page.getByLabel('API Key', { exact: true }).fill('synthetic-test-browser-key');
    await page.getByRole('button', { name: 'Use this API on this page', exact: true }).click();
    await expect(page.getByText(/Your API settings are enabled/)).toBeVisible();
    await page.getByRole('button', { name: 'Clear key', exact: true }).click();
    await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null)
      await new Promise<void>((done) => child.once('exit', () => done()));
  }
});
