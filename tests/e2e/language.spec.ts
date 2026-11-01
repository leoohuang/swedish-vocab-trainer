import { test, expect } from './fixtures';
test('界面切换和刷新保留语言、原文、词库选择与未完成练习', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Import my words', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import my words', exact: true }).click();
  await page.getByRole('radio', { name: 'Parse locally', exact: true }).check();
  await page.getByLabel('Deck name', { exact: true }).fill('我的原始词库 · Unit 1');
  await page.getByLabel('Your learning material').fill('ett äpple - 苹果\nen bok - 书');
  await page.getByRole('button', { name: 'Parse words', exact: true }).click();
  await page.getByRole('button', { name: 'Save deck', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '我的原始词库 · Unit 1', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('苹果', { exact: true })).toBeVisible();
  const deck = await page.getByLabel('Switch deck', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Start a group', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await page.getByRole('button', { name: "Ready, let's start", exact: true }).click();
  const term = await page.locator('.practice-card>h1').innerText();
  await page
    .locator('.option')
    .filter({ hasText: term === 'en bok' ? '书' : '苹果' })
    .click();
  await expect(page.getByRole('button', { name: 'Hear pronunciation', exact: true })).toBeVisible();
  await page
    .locator('.training-header-actions')
    .getByRole('button', { name: '中文', exact: true })
    .click();
  await expect(page.getByText('答对了，记忆又清晰了一点')).toBeVisible();
  await expect(page.locator('.practice-card>h1')).toHaveText(term);
  await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'My decks' })
    .click();
  await expect(page.getByLabel('Switch deck')).toHaveValue(deck);
  await expect(page.getByText('苹果', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue practice', exact: true }).click();
  await expect(page.locator('.practice-card>h1')).toHaveText(term);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 950 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('英文首页、设置和生成弹窗在手机与桌面不溢出', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'Data & settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Practice rules', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Test pronunciation', exact: true }).click();
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Generate by topic', exact: true }).click();
  await expect(page.getByLabel('SFI course', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Visiting the doctor', exact: true }).click();
  await expect(page.getByLabel('Vocabulary topic', { exact: true })).toHaveValue(
    'Visiting the doctor',
  );
  await page.setViewportSize({ width: 320, height: 950 });
  expect(await page.locator('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
});
