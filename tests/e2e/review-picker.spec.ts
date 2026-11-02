import { test, expect } from './fixtures';
async function seedReview(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词', exact: true }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('词库名称', { exact: true }).fill('日常生活');
  await page
    .getByLabel('你的学习材料')
    .fill(Array.from({ length: 29 }, (_, i) => `ord${i} - 释义${i}`).join('\n'));
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await page.evaluate(async () => {
    const req = indexedDB.open('keyval-store');
    const db = await new Promise<IDBDatabase>((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
    const tx = db.transaction('keyval', 'readwrite'),
      store = tx.objectStore('keyval'),
      read = store.get('ord-data-v1');
    read.onsuccess = () => {
      const d = read.result;
      const terms = [
        'en tid',
        'handla mat',
        'en buss',
        'en tidning',
        'ringa',
        'en läkare',
        'vila',
        'en cykel',
        'tvätta',
        'en dag',
      ];
      d.words = d.words.map((w: any, i: number) => ({
        ...w,
        term: `${terms[i % 10]} ${Math.floor(i / 10) + 1}`,
        sessions: 1,
        passed: true,
        due: Date.now() + (i < 5 ? -1000 : 86400000),
      }));
      d.decks.push({ ...d.decks[0], id: 'second-review-deck', name: 'SFI · 工作与职业' });
      d.words.push(
        ...d.words
          .slice(0, 20)
          .map((w: any, i: number) => ({
            ...w,
            id: `second-${i}`,
            deckId: 'second-review-deck',
            term: `arbete${i}`,
            due: Date.now() + 86400000,
          })),
      );
      store.put(d, 'ord-data-v1');
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.removeItem('ord-selected-deck');
  });
  await page.reload();
  await page.getByRole('button', { name: '我的词库' }).click();
  await page.getByLabel('切换词库').selectOption('');
  await page.getByRole('button', { name: '今日练习', exact: true }).click();
}
test('复习分词库显示，切换不混组选词，开始仅练当前组', async ({ page }) => {
  await seedReview(page);
  await page.getByRole('button', { name: '巩固练过的词', exact: true }).click();
  const dialog = page.locator('dialog');
  await expect(page.getByLabel('练习词库')).toHaveCount(1);
  await expect(dialog.locator('.study-group')).toHaveCount(3);
  await expect(dialog.locator('.study-group.completed')).toHaveCount(0);
  await expect(dialog.locator('.study-group').first()).toContainText('5 词到期');
  await expect(dialog.locator('.study-group').nth(1)).toContainText('随时可练');
  await page.getByLabel('练习词库').selectOption('second-review-deck');
  await expect(dialog.locator('.study-group')).toHaveCount(2);
  await expect(dialog.locator('.group-preview')).toContainText('arbete0');
  await expect(dialog.locator('.group-preview')).not.toContainText('en tid');
  await page.getByRole('button', { name: '自己选词', exact: true }).click();
  await expect(dialog.locator('.picker-list label')).toHaveCount(20);
  const first = await page.getByLabel('练习词库').locator('option').first().getAttribute('value');
  await page.getByLabel('练习词库').selectOption(first!);
  await expect(dialog.locator('.picker-list label')).toHaveCount(29);
  await page.getByRole('button', { name: '按组练习', exact: true }).click();
  await expect(dialog.locator('.study-group')).toHaveCount(3);
  await dialog.locator('.study-group').nth(2).click();
  await expect(dialog.locator('.modal-footer')).toContainText('第 3 组');
  await expect(dialog.locator('.modal-footer')).toContainText('9');
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.locator('.intro-grid > div')).toHaveCount(9);
  await expect(page.locator('.intro-grid')).not.toContainText('arbete');
});
test('复习弹窗单滚动区，中英界面及各屏幕宽度可用', async ({ page }) => {
  await seedReview(page);
  await page.getByRole('button', { name: '巩固练过的词', exact: true }).click();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator('dialog')
        .evaluate(
          (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1,
        ),
    ).toBe(true);
    await expect(page.getByRole('button', { name: '开始练习', exact: true })).toBeInViewport();
    await page.locator('.picker-body').evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(page.getByRole('button', { name: '开始练习', exact: true })).toBeInViewport();
    await page.locator('.picker-body').evaluate((el) => (el.scrollTop = 0));
    if (width === 320 || width === 1440)
      await page.screenshot({ path: `test-results/review-picker-${width}.png` });
  }
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Reinforce practiced words', exact: true }).click();
  await expect(page.getByLabel('Practice deck')).toBeVisible();
  await expect(page.locator('.study-group').nth(1)).toContainText('Ready to review');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.locator('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeInViewport();
});
