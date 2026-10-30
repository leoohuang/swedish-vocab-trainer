import { test, expect } from './fixtures';
const generated = {
  detectedMode: 'vocabulary',
  chunks: 1,
  skippedKnown: 0,
  summary: '主题「看病就医」 · SFI C · 已生成 1 / 10 个词。请核对。',
  drafts: [
    {
      id: 'topic-word',
      term: 'en tid',
      meaning: '预约时间',
      note: '名词 · tider',
      source: '',
      location: 'AI 主题词表 · 看病就医 · SFI C',
      selected: true,
      issue: '',
      ai: {
        mode: 'generated',
        meaningOrigin: 'ai',
        sfiLevel: 'C',
        topic: '看病就医',
        example: 'Jag vill boka en tid.',
        exampleTranslation: '我想预约一个时间。',
        reason: '就医时常用。',
      },
    },
  ],
};
async function ready(page: import('@playwright/test').Page) {
  await page.route('**/api/ai/status', (route) =>
    route.fulfill({
      json: {
        configured: true,
        model: 'test-model',
        provider: 'model.example',
        style: 'responses',
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '按主题生成词表', exact: true }).click();
}
test('选择主题和 SFI 后生成，编辑保存，刷新后仍能练习并保留旧词库', async ({ page }) => {
  let body: any;
  await page.route('**/api/ai/generate', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: generated });
  });
  await ready(page);
  await expect(page.getByRole('button', { name: '生成词表', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '看病就医', exact: true }).click();
  await page.getByLabel('SFI 课程', { exact: true }).selectOption('C');
  await page.getByLabel('词库名称', { exact: true }).fill('第 3 单元 · 医疗');
  await page.getByRole('checkbox', { name: /同意将本次主题/ }).check();
  await page.getByRole('button', { name: '生成词表', exact: true }).click();
  await expect(page.getByText('AI 生成例句 · 请核对', { exact: true })).toBeVisible();
  expect(body).toEqual({ topic: '看病就医', sfiLevel: 'C', count: 10, consent: true });
  await page.getByRole('textbox', { name: '词条释义', exact: true }).fill('预约的时间');
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await expect(page.getByRole('heading', { name: '第 3 单元 · 医疗', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '按主题生成词表', exact: true }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '导入单词', exact: true }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('你的学习材料').fill('en bok - 书');
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '我的词库' }).click();
  await expect(page.getByLabel('切换词库')).toContainText('全部词库 · 2 个词');
  await expect(page.getByText('en tid', { exact: true })).toBeVisible();
  await expect(page.getByText('en bok', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /01 第 3 单元 · 医疗/ }).click();
  await page.getByRole('button', { name: '编辑 en tid', exact: true }).click();
  await expect(page.getByText('AI 生成词表 · SFI C', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.getByRole('button', { name: '准备好了，开始', exact: true })).toBeVisible();
});
test('失败和取消保留主题，手机下无需材料即可生成', async ({ page }) => {
  await page.route('**/api/ai/generate', (route) =>
    route.fulfill({ status: 502, json: { error: '模型暂时不可用，请重试。' } }),
  );
  await ready(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () =>
          document.querySelector('dialog')!.scrollWidth <=
          document.querySelector('dialog')!.clientWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel('词表主题').fill('找工作');
  await page.getByLabel('SFI 课程', { exact: true }).selectOption('D');
  await page.getByRole('checkbox', { name: /同意将本次主题/ }).check();
  await page.getByRole('button', { name: '生成词表', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('模型暂时不可用');
  await expect(page.getByLabel('词表主题')).toHaveValue('找工作');
  await expect(page.getByLabel('SFI 课程', { exact: true })).toHaveValue('D');
  await page.route('**/api/ai/generate', () => new Promise(() => {}));
  await page.getByRole('button', { name: '生成词表', exact: true }).click();
  await page.getByRole('button', { name: '取消整理', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('已取消生成');
  await expect(page.getByLabel('词表主题')).toHaveValue('找工作');
});
