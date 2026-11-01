import { test, expect } from './fixtures';
const status = {
  configured: false,
  byokOnly: true,
  supportsUserKey: true,
  model: 'gpt-4.1-mini',
  provider: 'api.openai.com',
  style: 'responses',
};
const key = 'SYNTHETIC-BROWSER-KEY-NOT-A-REAL-CREDENTIAL';
test('用户自带 API 可用于 AI 整理，密钥不入词库或存储，刷新清除且词库仍在', async ({ page }) => {
  await page.route('**/api/ai/status', (route) => route.fulfill({ json: status }));
  let sent: Record<string, string> | undefined;
  await page.route('**/api/ai/extract', async (route) => {
    sent = route.request().headers();
    expect(JSON.stringify(route.request().postDataJSON())).not.toContain(key);
    await route.fulfill({
      json: {
        drafts: [
          {
            id: 'synthetic-word',
            term: 'en bok',
            meaning: '书',
            note: '',
            source: 'en bok - 书',
            location: 'synthetic',
            selected: true,
            issue: '',
          },
        ],
        detectedMode: 'vocabulary',
        chunks: 1,
        skippedKnown: 0,
        summary: 'Synthetic response',
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Import my words', exact: true }).click();
  await page.getByText('Use your own API / AI settings', { exact: true }).click();
  await page.getByLabel('API provider', { exact: true }).selectOption('custom');
  await page.getByLabel('Base URL', { exact: true }).fill('https://api.vendor.com/v1');
  await page.getByLabel('Model name', { exact: true }).fill('custom-model');
  await page.getByLabel('API format', { exact: true }).selectOption('chat');
  await page.getByLabel('API Key', { exact: true }).fill(key);
  await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Use this API on this page', exact: true }).click();
  await expect(page.getByText(/Your API settings are enabled/)).toBeVisible();
  await page.getByLabel('Your learning material').fill('en bok - 书');
  await page.getByRole('checkbox', { name: /I agree to send this material/ }).check();
  await page.getByRole('button', { name: 'Organize with AI', exact: true }).click();
  await page.getByRole('button', { name: 'Save deck', exact: true }).click();
  expect(sent).toMatchObject({
    'x-ord-ai-key': key,
    'x-ord-ai-model': 'custom-model',
    'x-ord-ai-url': 'https://api.vendor.com/v1',
    'x-ord-ai-style': 'chat',
  });
  const persisted = await page.evaluate(async () => {
    const r = indexedDB.open('keyval-store');
    const db = await new Promise<IDBDatabase>((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    const read = db.transaction('keyval', 'readonly').objectStore('keyval').get('ord-data-v1');
    const data = await new Promise((resolve) => {
      read.onsuccess = () => resolve(read.result);
    });
    db.close();
    return JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, data });
  });
  expect(persisted).not.toContain(key);
  expect(persisted).toContain('custom-model');
  await page.reload();
  await page.getByRole('button', { name: 'Data & settings', exact: true }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Base URL', { exact: true })).toHaveValue(
    'https://api.vendor.com/v1',
  );
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'My decks' })
    .click();
  await expect(page.getByText('en bok', { exact: true })).toBeVisible();
});
test('无密钥仍可本机整理，清除按钮生效，手机设置不溢出', async ({ page }) => {
  await page.route('**/api/ai/status', (route) => route.fulfill({ json: status }));
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词', exact: true }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('你的学习材料').fill('en bok - 书');
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await page.getByRole('button', { name: '数据与设置', exact: true }).click();
  await page.getByLabel('API Key', { exact: true }).fill(key);
  await page.getByRole('button', { name: '在本页使用此 API', exact: true }).click();
  await page.getByRole('button', { name: '清除密钥', exact: true }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  await expect(page.getByText('本页 API 密钥已清除。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 950 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
