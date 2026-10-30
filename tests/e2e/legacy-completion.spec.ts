import { test, expect } from './fixtures';
test('旧版未拼对的已结束练习不能当作过关，恢复练习后两次拼对才完成', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('你的学习材料').fill('en bok - 书');
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  await page.getByRole('button', { name: '保存并退出' }).click();
  await page.evaluate(async () => {
    const request = indexedDB.open('keyval-store');
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction('keyval', 'readwrite'),
      store = tx.objectStore('keyval');
    const read = store.get('ord-data-v1');
    read.onsuccess = () => {
      const d = read.result,
        s = d.session,
        id = s.ids[0];
      s.finished = true;
      s.position = s.tasks.length;
      s.ended = Date.now();
      delete s.turn;
      s.scores[id] = { wins: 0, tries: 4, misses: 4, hints: 0 };
      d.words[0].sessions = 1;
      delete d.words[0].passed;
      d.history = [{ id: s.id, date: s.ended, words: 1, completed: 0, attempts: 4, correct: 0 }];
      store.put(d, 'ord-data-v1');
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: '学习记录', exact: true }).click();
  await expect(page.getByText('未全过关（旧版）', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '今日练习', exact: true }).click();
  await page.getByRole('button', { name: '继续上次练习', exact: true }).click();
  await expect(page.locator('.practice-caption')).toContainText('0 / 2 次');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('bok');
    await page.getByRole('button', { name: '检查答案' }).click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    if (!i) await expect(page.getByRole('textbox', { name: '输入瑞典语答案' })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: '今天，又前进了一点。' })).toBeVisible();
  await page.getByRole('button', { name: '回到词库', exact: true }).click();
  await expect(page.getByText('已过关', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '学习记录', exact: true }).click();
  await expect(page.locator('.history-list>div')).toHaveCount(1);
  await expect(page.getByText('全部过关', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
