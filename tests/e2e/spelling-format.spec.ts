import { test, expect } from './fixtures';
test('旧版括号残留自动修复，句子无需输入句号，原练习仍需两次独立拼对', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词', exact: true }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page.getByLabel('你的学习材料').fill('ett äpple - 苹果');
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
      const d = read.result,
        w = d.words[0];
      w.term = 'Jag måste tvätta kläder idag. (';
      w.meaning = '我今天必须洗衣服。)';
      w.source = 'Jag måste tvätta kläder idag. (我今天必须洗衣服。)';
      w.group = 3;
      d.session = {
        id: 'legacy-bracket-session',
        ids: [w.id],
        tasks: [{ wordId: w.id, type: 'spell' }],
        position: 0,
        turn: 28,
        scores: { [w.id]: { wins: 0, tries: 3, misses: 3, hints: 0 } },
        feedback: { correct: false, answer: 'jag måste tvätta kläder idag.(', assisted: false },
        hinted: false,
        input: 'jag måste tvätta kläder idag.(',
        finished: false,
        started: Date.now(),
      };
      store.put(d, 'ord-data-v1');
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: '继续上次练习', exact: true }).click();
  await expect(page.locator('.meaning-prompt')).toHaveText('我今天必须洗衣服。');
  await expect(page.locator('.correct-answer')).toHaveText('Jag måste tvätta kläder idag.');
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('jag måste tvätta kläder idag');
  await page.getByRole('button', { name: '检查答案', exact: true }).click();
  await expect(page.locator('.practice-card')).toHaveClass(/answer-correct/);
  await expect(page.locator('.letter-difference')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'test-results/spelling-format-fixed.png' });
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.locator('.training-overlay')).not.toContainText('本轮练习完成');
  await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('Jag måste tvätta kläder idag.');
  await page.getByRole('button', { name: '检查答案', exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天，又前进了一点。' })).toBeVisible();
  await page.getByRole('button', { name: '回到词库', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '我的词库' })
    .click();
  await expect(page.locator('.word-table')).toContainText('Jag måste tvätta kläder idag.');
});
