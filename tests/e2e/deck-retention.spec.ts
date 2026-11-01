import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
async function addDeck(page: Page, term: string, first = false) {
  await page
    .getByRole('button', { name: first ? '导入我的单词' : '导入单词', exact: true })
    .click();
  await page.getByLabel('词库名称', { exact: true }).fill('同名词库');
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('你的学习材料').fill(`${term} - 测试释义`);
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await expect(page.getByText(term, { exact: true })).toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('keyval-store');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = db.transaction('keyval', 'readonly').objectStore('keyval').get('ord-data-v1');
    const data = await new Promise<any>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    db.close();
    return data;
  });
}
test('同名导入仍新增独立词库，原词条与进度刷新后保留', async ({ page }) => {
  await page.goto('/');
  await addDeck(page, 'äpple', true);
  await page.getByRole('button', { name: '收藏单词', exact: true }).click();
  await expect.poll(async () => (await stored(page)).words[0].favorite).toBe(true);
  const before = await stored(page);
  await addDeck(page, 'banan');
  await expect(page.getByLabel('切换词库')).toContainText('全部词库 · 2 个词');
  await page.getByLabel('切换词库').selectOption(before.decks[0].id);
  await expect(page.getByText('äpple', { exact: true })).toBeVisible();
  await expect.poll(async () => (await stored(page)).decks.length).toBe(2);
  await page.reload();
  const after = await stored(page);
  expect(after.words.find((w: { id: string }) => w.id === before.words[0].id)).toEqual(
    before.words[0],
  );
  expect(after.decks).toHaveLength(2);
  await page.getByRole('button', { name: '我的词库' }).click();
  await expect(page.getByText('äpple', { exact: true })).toBeVisible();
  await expect(page.getByText('banan', { exact: true })).toHaveCount(0);
  await page.getByLabel('切换词库').selectOption('');
  await expect(page.getByText('banan', { exact: true })).toBeVisible();
});
test('旧标签页保存不会覆盖另一页新增的词库', async ({ page, context }) => {
  await page.goto('/');
  await addDeck(page, 'äpple', true);
  await expect.poll(async () => (await stored(page))?.decks.length).toBe(1);
  const stale = await context.newPage();
  await stale.goto('/');
  await stale
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await addDeck(page, 'banan');
  await expect.poll(async () => (await stored(page)).decks.length).toBe(2);
  await addDeck(stale, 'citron');
  await expect(stale.getByRole('alert')).toContainText('另一个标签页已更新词库');
  const saved = await stored(page);
  expect(saved.decks).toHaveLength(2);
  expect(saved.words.map((w: { term: string }) => w.term)).toEqual(['äpple', 'banan']);
  await stale.reload();
  await stale
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await expect(stale.getByText('banan', { exact: true })).toBeVisible();
});

test('合并备份保留两个词库和原进度，重复导入不产生重复', async ({ page }) => {
  await page.goto('/');
  await addDeck(page, 'äpple', true);
  await expect.poll(async () => (await stored(page))?.decks.length).toBe(1);
  const incoming = structuredClone(await stored(page));
  incoming.decks[0].id = 'from-another-origin';
  incoming.words[0].id = 'imported-word';
  incoming.words[0].deckId = 'from-another-origin';
  incoming.words[0].term = 'banan';
  incoming.words[0].sessions = 2;
  incoming.words[0].interval = 3;
  incoming.words[0].due = 12345;
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '数据与设置' }).click();
    await page.locator('input[accept=".json,application/json"]').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
    await expect(page.getByRole('status')).toContainText('备份已合并');
    await expect(page.getByLabel('切换词库')).toContainText('全部词库 · 2 个词');
    const data = await stored(page);
    expect(data.decks).toHaveLength(2);
    expect(data.words.find((w: { id: string }) => w.id === 'imported-word')).toEqual(
      incoming.words[0],
    );
  }
  await page.reload();
  expect((await stored(page)).decks).toHaveLength(2);
});
