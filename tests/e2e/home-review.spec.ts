import { test, expect } from './fixtures';
test('首页可按当前词库复习到期词，也可巩固未到期和旧版练过的词', async ({ page }) => {
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
  await add('复习单元', 'ord0 - 释义0\nord1 - 释义1\nord2 - 释义2\nord3 - 释义3', true);
  const chosen = await page.getByLabel('切换词库').inputValue();
  await add('其他单元', 'annan - 其他');
  const other = await page.getByLabel('切换词库').inputValue();
  await page.getByLabel('切换词库').selectOption(chosen);
  await page.evaluate(async () => {
    const r = indexedDB.open('keyval-store');
    const db = await new Promise<IDBDatabase>((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction('keyval', 'readwrite'),
      store = tx.objectStore('keyval');
    const read = store.get('ord-data-v1');
    read.onsuccess = () => {
      const d = read.result;
      for (const w of d.words)
        if (w.term !== 'ord3') {
          w.sessions = 1;
          w.due = Date.now() + (w.term === 'ord0' || w.term === 'annan' ? -1000 : 86400000);
          if (w.term !== 'ord2') w.passed = true;
        }
      store.put(d, 'ord-data-v1');
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  const review = page.getByRole('region', { name: '温故，才能记得更久。' });
  await expect(review).toContainText('当前词库 · 复习单元');
  await expect(review).toContainText('到期复习 1 词');
  await expect(review).toContainText('主动巩固 3 词');
  await review.getByRole('button', { name: '复习到期单词', exact: true }).click();
  await expect(page.locator('.group-preview')).toContainText('ord0');
  await expect(page.locator('.group-preview')).not.toContainText('ord1');
  await expect(page.locator('.group-preview')).not.toContainText('annan');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await review.getByRole('button', { name: '巩固练过的词', exact: true }).click();
  for (const term of ['ord0', 'ord1', 'ord2'])
    await expect(page.locator('.group-preview')).toContainText(term);
  await expect(page.locator('.group-preview')).not.toContainText('ord3');
  await page.getByRole('button', { name: '自己选词', exact: true }).click();
  await page.getByRole('button', { name: '按组练习', exact: true }).click();
  await expect(page.locator('.modal-footer')).toContainText('3');
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  await expect(review.getByRole('button', { name: '巩固练过的词' })).toBeDisabled();
  await expect(review.getByRole('button', { name: '继续当前练习' })).toBeVisible();
  await review.getByRole('button', { name: '继续当前练习' }).click();
  await expect(page.locator('.training-overlay')).toBeVisible();
  await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await expect(page.getByLabel('切换词库')).toHaveValue(chosen);
  await page.getByLabel('切换词库').selectOption(other);
  await page.getByRole('button', { name: '今日练习', exact: true }).click();
  await expect(review).toContainText('当前词库 · 其他单元');
  await expect(review).toContainText('主动巩固 1 词');
});
test('没有练过的词时首页复习入口说明空状态，手机布局无溢出', async ({ page }) => {
  await page.goto('/');
  const review = page.getByRole('region', { name: '温故，才能记得更久。' });
  await expect(review.getByRole('button', { name: '复习到期单词' })).toBeDisabled();
  await expect(review.getByRole('button', { name: '巩固练过的词' })).toBeDisabled();
  for (const width of [320, 740, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
