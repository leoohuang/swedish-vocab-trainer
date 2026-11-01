import { test, expect } from '@playwright/test';
// Explicitly opt in: ORD_RECORD_DEMO=1 npx playwright test tests/e2e/record-demo.spec.ts
// Records real local parsing/practice with synthetic words. No AI requests or personal data.
test('record the public project demo with synthetic vocabulary', async ({ browser }) => {
  test.skip(process.env.ORD_RECORD_DEMO !== '1', 'Media generation is an explicit task.');
  test.setTimeout(120000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: 'test-results/demo-video', size: { width: 1280, height: 800 } },
  });
  await context.addInitScript(() => localStorage.setItem('ord-language', 'en'));
  const page = await context.newPage();
  const pause = (ms = 1100) => page.waitForTimeout(ms);
  let aiCalls = 0;
  await page.route('**/api/ai/extract', (route) => {
    aiCalls++;
    return route.abort();
  });
  await page.route('**/api/ai/generate', (route) => {
    aiCalls++;
    return route.abort();
  });
  try {
    await page.goto('http://127.0.0.1:5173/');
    await expect(page.getByRole('button', { name: 'Import my words', exact: true })).toBeVisible();
    await page.screenshot({ path: 'docs/media/home-en.png' });
    await pause(2400);
    await page.getByRole('button', { name: 'Import my words', exact: true }).click();
    await page.getByRole('radio', { name: 'Parse locally', exact: true }).check();
    await page.getByLabel('Deck name', { exact: true }).fill('Everyday Swedish');
    await page
      .getByLabel('Your learning material')
      .pressSequentially('en bok - book\nett äpple - apple\nläsa - read', { delay: 35 });
    await pause(1600);
    await page.getByRole('button', { name: 'Parse words', exact: true }).click();
    await pause(2000);
    await page.getByRole('button', { name: 'Save deck', exact: true }).click();
    await pause(1600);
    await page.screenshot({ path: 'docs/media/deck-en.png' });
    await page.getByRole('button', { name: 'Start a group', exact: true }).click();
    await pause(1400);
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    await pause(1800);
    await page.getByRole('button', { name: "Ready, let's start", exact: true }).click();
    const meanings: Record<string, string> = {
      'en bok': 'book',
      'ett äpple': 'apple',
      läsa: 'read',
    };
    for (let i = 0; i < 3; i++) {
      const term = await page.locator('.practice-card>h1').innerText();
      await pause();
      await page.locator('.option').filter({ hasText: meanings[term] }).click();
      await pause(750);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    const answers: Record<string, string> = { book: 'bok', apple: 'äpple', read: 'läsa' };
    for (let i = 0; i < 7; i++) {
      const meaning = await page.locator('.meaning-prompt').innerText();
      await page
        .getByRole('textbox', { name: 'Enter your Swedish answer' })
        .pressSequentially(i === 0 ? 'wrong' : answers[meaning], { delay: 75 });
      await pause(450);
      await page.getByRole('button', { name: 'Check answer', exact: true }).click();
      await pause(1000);
      if (i === 1) await page.screenshot({ path: 'docs/media/practice-en.png' });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    await expect(
      page.getByRole('heading', { name: 'Another small step forward.', exact: true }),
    ).toBeVisible();
    await pause(2000);
    await page.getByRole('button', { name: 'Back to deck', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Practice', exact: true })
      .click();
    await page.getByRole('button', { name: 'Go to review', exact: true }).click();
    await pause(1800);
    await page.screenshot({ path: 'docs/media/review-en.png' });
    await page.getByRole('button', { name: 'Reinforce practiced words', exact: true }).click();
    await pause(1800);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await pause(1800);
    expect(aiCalls).toBe(0);
  } finally {
    await context.close();
    await page.video()!.saveAs('test-results/ord-demo-source.webm');
  }
});
