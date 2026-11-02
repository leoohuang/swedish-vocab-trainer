import { test, expect } from './fixtures';
const lesson = 'På morgonen åt jag frukost. Sedan läste jag en bok. Jag tycker om att läsa.';
const response = {
  detectedMode: 'article',
  summary: '推荐 1 个词，其他候选可手动补选。',
  skippedKnown: 0,
  chunks: 1,
  drafts: [
    {
      id: 'ai-word-1',
      term: 'läsa',
      meaning: '阅读',
      note: 'läste · läst',
      source: 'Sedan läste jag en bok.',
      location: '粘贴材料 · 片段 1',
      selected: true,
      issue: '',
      ai: {
        reason: '课文中的常用动作，适合初学者。',
        example: 'Sedan läste jag en bok.',
        exampleTranslation: '然后我读了一本书。',
        meaningOrigin: 'ai',
        mode: 'article',
      },
    },
  ],
};
async function aiReady(page: import('@playwright/test').Page) {
  await page.route('**/api/ai/status', (r) =>
    r.fulfill({
      json: { configured: true, model: 'test-model', provider: 'test.example', style: 'responses' },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
}
test('课文模式、水平与目标传入接口，原句和推荐原因保存后可查', async ({ page }) => {
  let body: any;
  await page.route('**/api/ai/extract', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: response });
  });
  await aiReady(page);
  await page.getByLabel('你的学习材料').fill(lesson);
  await page.getByLabel('材料类型', { exact: true }).selectOption('article');
  await page.getByLabel('学习水平', { exact: true }).selectOption('intermediate');
  await page.getByLabel('课文推荐词数', { exact: true }).selectOption('20');
  await expect(page.getByRole('button', { name: '用 AI 整理', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '用 AI 整理', exact: true }).click();
  await expect(page.getByText('推荐原因', { exact: true })).toBeVisible();
  await expect(page.getByText('AI 补充释义 · 请核对', { exact: true })).toBeVisible();
  await expect(page.getByText('课文中的常用动作，适合初学者。')).toBeVisible();
  await expect(page.locator('.ai-evidence blockquote [lang=sv]')).toBeVisible();
  expect(body.mode).toBe('article');
  expect(body.level).toBe('intermediate');
  expect(body.count).toBe(20);
  expect(body.blocks[0].text).toBe(lesson);
  expect(body.knownTerms).toEqual([]);
  expect(body.consent).toBe(true);
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '我的词库' }).click();
  await page.getByRole('button', { name: '编辑 läsa' }).click();
  await expect(page.getByText('课文中的常用动作，适合初学者。')).toBeVisible();
});
test('AI 失败保留材料并可重试，不自动退回规则伪装成功', async ({ page }) => {
  await aiReady(page);
  await page.route('**/api/ai/extract', (r) =>
    r.fulfill({ status: 502, json: { error: '模型服务当前限流，请稍后重试。' } }),
  );
  await page.getByLabel('你的学习材料').fill(lesson);
  await page.getByRole('button', { name: '用 AI 整理', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('限流');
  await expect(page.getByLabel('你的学习材料')).toHaveValue(lesson);
  await expect(page.getByRole('heading', { name: '确认你的单词' })).toHaveCount(0);
});
test('默认无密钥时明确显示未配置，不发送材料', async ({ page }) => {
  await page.route('**/api/ai/status', (r) =>
    r.fulfill({
      json: {
        configured: false,
        provider: 'api.openai.com',
        model: 'gpt-5-mini',
        style: 'responses',
      },
    }),
  );
  let calls = 0;
  await page.route('**/api/ai/extract', (r) => {
    calls++;
    void r.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await page.getByLabel('你的学习材料').fill(lesson);
  await expect(page.getByRole('button', { name: '用 AI 整理', exact: true })).toBeDisabled();
  await expect(page.getByText(/尚未填写 API 密钥/)).toBeVisible();
  expect(calls).toBe(0);
});
test('上传课文保留全文，合集模式不显示词数限制', async ({ page }) => {
  await aiReady(page);
  await page
    .locator('dialog input[type=file]')
    .setInputFiles({ name: 'lesson.txt', mimeType: 'text/plain', buffer: Buffer.from(lesson) });
  await expect(page.getByLabel('你的学习材料')).toHaveValue(lesson);
  await expect(page.getByRole('heading', { name: '确认你的单词' })).toHaveCount(0);
  await page.getByLabel('材料类型', { exact: true }).selectOption('vocabulary');
  await expect(page.getByLabel('课文推荐词数', { exact: true })).toBeDisabled();
  await expect(page.getByText(/不按目标词数删减/)).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () =>
          document.querySelector('dialog')!.scrollWidth <=
          document.querySelector('dialog')!.clientWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: 'test-results/ai-import-mobile.png' });
});

test('填写密钥后回到窗口会刷新配置状态，无须重开材料', async ({ page }) => {
  let configured = false;
  await page.route('**/api/ai/status', (r) =>
    r.fulfill({
      json: { configured, provider: 'api.openai.com', model: 'gpt-4.1-mini', style: 'responses' },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await expect(page.getByText(/尚未填写 API 密钥/)).toBeVisible();
  await page.getByLabel('你的学习材料').fill(lesson);
  await expect(page.getByRole('button', { name: '用 AI 整理', exact: true })).toBeDisabled();
  configured = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: '用 AI 整理', exact: true })).toBeEnabled();
  await expect(page.getByLabel('你的学习材料')).toHaveValue(lesson);
});
