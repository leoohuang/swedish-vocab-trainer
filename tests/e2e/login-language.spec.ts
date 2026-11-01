import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSiteAuth } from '../../server/site-auth';
test('独立登录页切换中英文保留输入，登录安全流程保持有效', async ({ page }) => {
  let auth: ReturnType<typeof createSiteAuth>;
  const server = createServer((req, res) => void auth(req, res, () => res.end('Signed in')));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  auth = createSiteAuth('synthetic-only-password', origin);
  try {
    await page.goto(origin);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Continue your Swedish practice' }),
    ).toBeVisible();
    await page
      .getByLabel('Website access password', { exact: true })
      .fill('synthetic-only-password');
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect(page.getByLabel('网站访问密码', { exact: true })).toHaveValue(
      'synthetic-only-password',
    );
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.getByRole('button', { name: 'Open my decks', exact: true }).click();
    await expect(page.locator('body')).toHaveText('Signed in');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
