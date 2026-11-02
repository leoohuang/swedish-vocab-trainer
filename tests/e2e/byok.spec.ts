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
const result = {
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
};
test('选 OpenAI 填密钥保存一次，刷新可直接整理，备份不含密钥', async ({ page }) => {
  await page.route('**/api/ai/status', (r) => r.fulfill({ json: status }));
  let sent: Record<string, string> | undefined;
  await page.route('**/api/ai/extract', async (r) => {
    sent = r.request().headers();
    expect(r.request().postDataJSON().consent).toBe(true);
    expect(JSON.stringify(r.request().postDataJSON())).not.toContain(key);
    await r.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Data & settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'OpenAI', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('group', { name: 'API provider' }).locator('img')).toHaveCount(2);
  await page.getByLabel('API Key', { exact: true }).fill(key);
  await expect(page.getByLabel('API Key', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Save AI settings', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Import my words', exact: true }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveCount(0);
  await page.getByLabel('Your learning material').fill('en bok - 书');
  await expect(page.getByRole('button', { name: 'Organize with AI', exact: true })).toBeEnabled();
  await expect(page.getByText(/Clicking Organize with AI sends/)).toBeVisible();
  await page.getByRole('button', { name: 'Organize with AI', exact: true }).click();
  await page.getByRole('button', { name: 'Save deck', exact: true }).click();
  expect(sent).toMatchObject({
    'x-ord-ai-key': key,
    'x-ord-ai-model': 'gpt-4.1-mini',
    'x-ord-ai-url': 'https://api.openai.com/v1',
    'x-ord-ai-style': 'responses',
  });
  await page.getByRole('button', { name: 'Data & settings', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const backup = await download;
  const fs = await import('node:fs/promises');
  expect(await fs.readFile((await backup.path())!, 'utf8')).not.toContain(key);
  await page.getByRole('button', { name: 'Clear key', exact: true }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(key);
  await page.reload();
  await page.getByRole('button', { name: 'Data & settings', exact: true }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
});
test('不记住时刷新清除，切换服务商清空输入，手机设置不溢出', async ({ page }) => {
  await page.route('**/api/ai/status', (r) => r.fulfill({ json: status }));
  await page.goto('/');
  await page.getByRole('button', { name: '数据与设置', exact: true }).click();
  await page.getByRole('button', { name: '自定义接口', exact: true }).click();
  await page.getByLabel('Base URL', { exact: true }).fill('https://api.vendor.com/v1');
  await page.getByLabel('模型名称', { exact: true }).fill('custom-model');
  await page.getByLabel('API Key', { exact: true }).fill(key);
  await page.getByRole('checkbox', { name: /记住此设备/ }).uncheck();
  await page.getByRole('button', { name: '保存 AI 设置', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(key);
  await page.reload();
  await page.getByRole('button', { name: '数据与设置', exact: true }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Base URL', { exact: true })).toHaveValue(
    'https://api.vendor.com/v1',
  );
  await page.getByLabel('API Key', { exact: true }).fill(key);
  await page.getByRole('button', { name: 'Anthropic', exact: true }).click();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
test('在导入中打开设置不丢材料，Anthropic 保存后立刻可点整理，无需刷新', async ({ page }) => {
  await page.route('**/api/ai/status', (r) => r.abort());
  let sent: Record<string, string> | undefined;
  await page.route('**/api/ai/extract', async (r) => {
    sent = r.request().headers();
    await r.fulfill({ json: result });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词', exact: true }).click();
  await page.getByLabel('你的学习材料').fill('en bok - 书');
  await expect(page.getByRole('button', { name: '用 AI 整理', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '打开 AI 设置', exact: true }).click();
  await page.getByRole('button', { name: 'Anthropic', exact: true }).click();
  await page.getByLabel('API Key', { exact: true }).fill(key);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/ai-provider-settings.png' });
  await page.getByRole('button', { name: '保存 AI 设置', exact: true }).click();
  await expect(page.getByLabel('你的学习材料')).toHaveValue('en bok - 书');
  await expect(page.getByRole('button', { name: '用 AI 整理', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '用 AI 整理', exact: true }).click();
  expect(sent).toMatchObject({
    'x-ord-ai-key': key,
    'x-ord-ai-model': 'claude-haiku-5-5',
    'x-ord-ai-url': 'https://api.anthropic.com/v1',
    'x-ord-ai-style': 'anthropic',
  });
});
