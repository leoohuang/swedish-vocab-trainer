import { test, expect } from '@playwright/test';
for (const ext of ['docx', 'xlsx', 'csv', 'pdf'])
  test(`真实 ${ext} 文件可解析并保存`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '导入我的单词' }).click();
    await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
    await page.locator('dialog input[type=file]').setInputFiles(`tests/fixtures/words.${ext}`);
    await expect(page.getByRole('heading', { name: '确认你的单词' })).toBeVisible();
    const terms = await page
      .getByRole('textbox', { name: '瑞典语词条', exact: true })
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value));
    expect(terms).toHaveLength(2);
    expect(terms).toContain(ext === 'xlsx' || ext === 'csv' ? 'ett äpple' : 'en bok');
    await page.getByRole('button', { name: '保存词库', exact: true }).click();
    await expect(page.getByRole('button', { name: '开始一组练习' })).toBeVisible();
    await expect(
      page.getByText(ext === 'xlsx' || ext === 'csv' ? 'ett äpple' : 'en bok', { exact: true }),
    ).toBeVisible();
  });
test('无文字 PDF 给出扫描件提示', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.locator('dialog input[type=file]').setInputFiles('tests/fixtures/empty.pdf');
  await expect(page.getByRole('alert')).toContainText('扫描 PDF');
});
