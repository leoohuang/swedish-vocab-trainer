import { test, expect } from './fixtures';
test('持续错词不提前结束，刷新保留计数，过关词退出本轮直到全部过关', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('你的学习材料').fill('en bok - 书\nett äpple - 苹果');
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  for (let i = 0; i < 2; i++) {
    const term = await page.locator('.practice-card>h1').innerText();
    await page
      .locator('.option')
      .filter({ hasText: term === 'en bok' ? '书' : '苹果' })
      .click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  async function submit(value: string) {
    await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill(value);
    await page.getByRole('button', { name: '检查答案' }).click();
  }
  for (let i = 0; i < 10; i++) {
    await submit('wrong');
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await expect(page.locator('.practice-progress')).toContainText('已过关 0 / 2 个词');
  const first = await page.locator('.meaning-prompt').innerText();
  await submit(first === '书' ? 'bok' : 'äpple');
  await expect(page.locator('.practice-caption')).toContainText('已降低频率');
  await page.getByRole('button', { name: '保存并退出' }).click();
  await page.reload();
  await page.getByRole('button', { name: '继续上次练习' }).click();
  await expect(page.locator('.practice-caption')).toContainText('1 / 2 次');
  await page.getByRole('button', { name: '继续', exact: true }).click();
  const wins: Record<string, number> = { [first]: 1 };
  let mastered = 0;
  for (let i = 0; i < 3; i++) {
    const meaning = await page.locator('.meaning-prompt').innerText();
    expect(wins[meaning] || 0).toBeLessThan(2);
    await submit(meaning === '书' ? 'bok' : 'äpple');
    wins[meaning] = (wins[meaning] || 0) + 1;
    if (wins[meaning] === 2) {
      mastered++;
      await expect(page.locator('.practice-caption')).toContainText('本轮已过关，不再出现');
    }
    await expect(page.locator('.practice-progress')).toContainText(`已过关 ${mastered} / 2 个词`);
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: '今天，又前进了一点。' })).toBeVisible();
  await expect(page.getByText('本轮达标', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
