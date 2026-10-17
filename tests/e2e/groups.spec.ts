import { test, expect } from './fixtures';
async function seed(page: import('@playwright/test').Page, count = 50, completed = 10) {
  await page.goto('/');
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await page.getByRole('radio', { name: '本机规则整理', exact: true }).check();
  await page
    .getByLabel('你的学习材料')
    .fill(Array.from({ length: count }, (_, i) => `ord${i} - 释义${i}`).join('\n'));
  await page.getByRole('button', { name: '整理单词', exact: true }).click();
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  if (completed)
    await page.evaluate(async (completed) => {
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
      data.words = data.words.map((w: any, i: number) => ({
        ...w,
        sessions: i < completed ? 1 : 0,
      }));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(data, 'ord-data-v1');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, completed);
  await page.reload();
  await page.getByRole('button', { name: '我的词库' }).click();
}
test('50 词显示 5 组，默认第二组，刷新仍继续第二组', async ({ page }) => {
  await seed(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
    await expect(page.locator('.study-group')).toHaveCount(5);
    await expect(page.getByRole('button', { name: /第 2 组 ·/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: /第 1 组 ·/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.locator('.group-preview')).toContainText('ord10');
    await expect(page.locator('.group-preview')).not.toContainText('ord0');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    if (!attempt) {
      await page.reload();
      await page.getByRole('button', { name: '我的词库' }).click();
    }
  }
});
test('最后一组只有一个词，完成后没有默认重练，仍可手动重练', async ({ page }) => {
  await seed(page, 11, 10);
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await expect(page.locator('.group-preview')).toContainText('ord10');
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  await page.locator('.option').filter({ hasText: '释义10' }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('ord10');
    await page.getByRole('button', { name: '检查答案' }).click();
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await page.getByRole('button', { name: '回到词库' }).click();
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始练习', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /第 2 组 ·/ }).click();
  await expect(page.getByRole('button', { name: '开始练习', exact: true })).toBeEnabled();
});
test('声音、朗读和错误动画跟随新答案触发，开关可保存', async ({ page }) => {
  await seed(page, 1, 0);
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  await page.getByRole('button', { name: '翻开释义' }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page
    .getByRole('textbox', { name: '输入瑞典语答案' })
    .pressSequentially('wrong', { delay: 40 });
  await page.getByRole('button', { name: '检查答案' }).click();
  await expect(page.locator('.practice-card')).toHaveClass(/answer-wrong/);
  await expect.poll(() => page.evaluate(() => (window as any).__ordAudio.keys)).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).__ordAudio.tones.includes(185)))
    .toBe(true);
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill('ord0');
  await page.getByRole('button', { name: '检查答案' }).click();
  await expect(page.locator('.practice-card')).toHaveClass(/answer-correct/);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__ordAudio.utterances.filter((s: string) => s === 'ord0').length,
      ),
    )
    .toBe(2);
  await expect
    .poll(() => page.evaluate(() => (window as any).__ordAudio.tones.includes(660)))
    .toBe(true);
  await page.getByLabel('声音设置', { exact: true }).click();
  await page.getByRole('switch', { name: '答对自动朗读', exact: true }).uncheck();
  await page.getByRole('switch', { name: '键盘音效', exact: true }).uncheck();
  await page.getByRole('switch', { name: '答题音效', exact: true }).uncheck();
  await page.getByLabel('声音设置', { exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  const previous = await page.evaluate(() => (window as any).__ordAudio.tones.length);
  await page
    .getByRole('textbox', { name: '输入瑞典语答案' })
    .pressSequentially('ord0', { delay: 40 });
  await page.getByRole('button', { name: '检查答案' }).click();
  expect(await page.evaluate(() => (window as any).__ordAudio.tones.length)).toBe(previous);
  expect(await page.evaluate(() => (window as any).__ordAudio.utterances.length)).toBe(2);
  await page.getByRole('button', { name: '保存并退出' }).click();
  await page.reload();
  await page.getByRole('button', { name: '数据与设置' }).click();
  await expect(page.getByRole('switch', { name: '答对自动朗读' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: '键盘音效' })).not.toBeChecked();
});
test('分组手机布局无横向滚动，减少动态效果会关闭答题动画', async ({ page }) => {
  await seed(page, 21, 10);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        document.querySelector('dialog')!.scrollWidth <=
        document.querySelector('dialog')!.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/groups-mobile.png' });
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.option').first().click();
  expect(
    await page.locator('.practice-card').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});

test('实际完成第一组十个词后，下一次开始默认第二组', async ({ page }) => {
  await seed(page, 11, 0);
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await expect(page.getByRole('button', { name: /第 1 组 ·/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '准备好了，开始' }).click();
  for (let i = 0; i < 30; i++) {
    if (i < 10) {
      const term = await page.locator('.practice-card>h1').innerText();
      await page
        .locator('.option')
        .filter({ hasText: new RegExp(`^.*释义${term.slice(3)}$`) })
        .click();
    } else {
      const meaning = await page.locator('.meaning-prompt').innerText();
      await page.getByRole('textbox', { name: '输入瑞典语答案' }).fill(`ord${meaning.slice(2)}`);
      await page.getByRole('button', { name: '检查答案' }).click();
    }
    await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: '今天，又前进了一点。' })).toBeVisible();
  await page.getByRole('button', { name: '回到词库' }).click();
  await page.reload();
  await page.getByRole('button', { name: '我的词库' }).click();
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await expect(page.getByRole('button', { name: /第 2 组 ·/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.group-preview')).toContainText('ord10');
});
