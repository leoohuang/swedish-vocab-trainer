import { test, expect } from './fixtures';
test('练完返回、导航和刷新都保留所选词库，直到手动切换', async ({ page }) => {
  await page.goto('/');
  async function add(name: string, text: string, first = false) {
    await page
      .getByRole('button', { name: first ? '导入我的单词' : '导入单词', exact: true })
      .click();
    await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
    await page.getByLabel('词库名称', { exact: true }).fill(name);
    await page.getByLabel('你的学习材料').fill(text);
    await page.getByRole('button', { name: '整理单词', exact: true }).click();
    await page.getByRole('button', { name: '保存词库', exact: true }).click();
  }
  await add('第一单元', 'en bok - 书', true);
  const first = await page.getByLabel('切换词库').inputValue();
  await add('第二单元', 'ett äpple - 苹果');
  const second = await page.getByLabel('切换词库').inputValue();
  await page.getByLabel('切换词库').selectOption(first);
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  await page.locator('.option').filter({ hasText: '书' }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('bok');
    await page.getByRole('button', { name: '检查答案' }).click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await page.getByRole('button', { name: '回到词库', exact: true }).click();
  await expect(page.getByLabel('切换词库')).toHaveValue(first);
  await expect(page.getByText('en bok', { exact: true })).toBeVisible();
  await expect(page.getByText('ett äpple', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '数据与设置', exact: true }).click();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await expect(page.getByLabel('切换词库')).toHaveValue(first);
  await page.reload();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await expect(page.getByLabel('切换词库')).toHaveValue(first);
  await page.getByLabel('切换词库').selectOption(second);
  await page.getByRole('button', { name: '今日练习', exact: true }).click();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await expect(page.getByLabel('切换词库')).toHaveValue(second);
  await page.getByLabel('切换词库').selectOption('');
  await page.reload();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await expect(page.getByLabel('切换词库')).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
