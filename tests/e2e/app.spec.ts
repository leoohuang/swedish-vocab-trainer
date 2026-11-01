import { test, expect } from './fixtures';
const seedText = 'ett äpple - 苹果\nen bok - 书\nläsa - 阅读\nfika - 喝咖啡小憩\nbehöver kolla';
async function importText(page: import('@playwright/test').Page, text = seedText) {
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('你的学习材料').fill(text);
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始一组练习', exact: true })).toBeVisible();
}
test('导入待整理可修正，刷新与重复内容保存正确', async ({ page }) => {
  await importText(page);
  await expect(page.getByRole('button', { name: '1 条待整理' })).toBeVisible();
  await page.getByRole('button', { name: '1 条待整理' }).click();
  await page.getByRole('textbox', { name: '词条释义', exact: true }).fill('需要检查');
  await page.getByRole('checkbox', { name: '导入 behöver kolla', exact: true }).check();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await expect(page.getByText('behöver kolla', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '我的词库' }).click();
  await expect(page.getByText('behöver kolla', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑 ett äpple' }).click();
  await expect(page.getByText('修改词条会保留学习进度。')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
});
test('选择→拼写→特殊字母→暂停续练→错词回练→完整结果→备份恢复', async ({ page }) => {
  await importText(page, 'ett äpple - 苹果');
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  await page.getByRole('button', { name: '翻开释义' }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('apple');
  await page.getByRole('button', { name: '检查答案' }).click();
  await expect(page.getByText('没关系，我们再记一次')).toBeVisible();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并退出' }).click();
  await page.reload();
  await page.getByRole('button', { name: '继续上次练习' }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('äpple');
    await page.getByRole('button', { name: '检查答案' }).click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: '今天，又前进了一点。' })).toBeVisible();
  await expect(page.getByText('本轮达标', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '回到词库' }).click();
  await page.getByRole('button', { name: '学习记录' }).click();
  await expect(page.getByText('1 个词的练习')).toBeVisible();
  await page.getByRole('button', { name: '数据与设置' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  const dl = await event;
  await dl.saveAs('test-results/backup.json');
  page.once('dialog', (d) => d.accept());
  await page.locator('input[type=file][accept=".json"]').setInputFiles('test-results/backup.json');
  await expect(page.getByText('备份已恢复。', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '学习记录' }).click();
  await expect(page.getByText('1 个词的练习')).toBeVisible();
});
test('多词选择题答对后进入拼写，提示正确不计独立答对', async ({ page }) => {
  await importText(page);
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  const meaning: Record<string, string> = {
    'ett äpple': '苹果',
    'en bok': '书',
    läsa: '阅读',
    fika: '喝咖啡小憩',
  };
  for (let i = 0; i < 4; i++) {
    const term = await page.locator('.practice-card>h1').innerText();
    await page.locator('.option').filter({ hasText: meaning[term] }).click();
    await expect(page.getByText('答对了，记忆又清晰了一点')).toBeVisible();
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await page.getByRole('button', { name: '看一眼提示' }).click();
  const prompt = await page.locator('.meaning-prompt').innerText();
  const term = Object.keys(meaning)
    .find((k) => meaning[k] === prompt)!
    .replace(/^(en|ett) /, '');
  await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill(term);
  await page.getByRole('button', { name: '检查答案' }).click();
  await expect(page.getByText('有提示也没关系，再独立试一次')).toBeVisible();
  await expect(
    page.getByText('这个词已独立拼对 0 / 2 次 · 继续练习，直到独立拼对两次'),
  ).toBeVisible();
});
test('桌面与手机布局没有横向溢出，导入弹窗可用', async ({ page }) => {
  await page.goto('/');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.getByRole('button', { name: '导入我的单词' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: '试试示例笔记' }).click();
  expect(
    await page.evaluate(
      () =>
        document.querySelector('dialog')!.scrollWidth <=
        document.querySelector('dialog')!.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/import-mobile.png' });
});
test('错误文件与损坏备份有明确提示，已有词库保留', async ({ page }) => {
  await importText(page);
  await page.getByRole('button', { name: '导入单词', exact: true }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page
    .locator('dialog input[type=file]')
    .setInputFiles({ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('') });
  await expect(page.getByRole('alert')).toContainText('没有读到内容');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '数据与设置' }).click();
  await page.locator('input[type=file][accept=".json"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole('status')).toContainText('恢复失败');
  await page.getByRole('button', { name: '我的词库' }).click();
  await expect(page.getByText('ett äpple', { exact: true })).toBeVisible();
});

test('重复词合并不同备注且保留同形异义', async ({ page }) => {
  await importText(page, 'en bok - 书 / böcker\nen bok - 书 / boken\nen bok - 山毛榉');
  await expect(page.locator('.word-row:not(.table-head)')).toHaveCount(2);
  await expect(page.getByText('böcker · boken', { exact: true })).toBeVisible();
  await expect(page.getByText('山毛榉', { exact: true })).toBeVisible();
});
