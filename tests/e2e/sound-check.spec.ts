import { test, expect } from './fixtures';
test('设置页可分别检查读音和音效，并显示通道与语音状态', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '数据与设置' }).click();
  await expect(page.getByText('瑞典语语音：Swedish test voice', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '测试正确音', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__ordAudio.tones.includes(660)))
    .toBe(true);
  await expect(page.getByText('音效通道：已启用', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '测试错误音', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__ordAudio.tones.includes(185)))
    .toBe(true);
  await page.getByRole('button', { name: '测试键盘音', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__ordAudio.keys)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '测试读音', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__ordAudio.utterances)).toContain(
    'Hej! Välkommen till din svenska träning.',
  );
  await page.setViewportSize({ width: 320, height: 950 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
