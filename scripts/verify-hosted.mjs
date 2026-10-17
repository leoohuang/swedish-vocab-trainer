import { chromium, expect } from '@playwright/test';
// Credentials enter through hidden stdin, never command-line arguments or files.
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
let input = '';
console.log('Ready for verification JSON on stdin (input is hidden).');
const config = await new Promise((resolve, reject) => {
  process.stdin.on('data', (chunk) => {
    if (chunk.includes('\u0003')) process.exit(130);
    input += chunk;
    if (input.includes('\n')) {
      try {
        resolve(JSON.parse(input.trim()));
      } catch {
        reject(new Error('Invalid verification input'));
      }
      process.stdin.pause();
    }
  });
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
const { url, bearer } = config;
const origin = new URL(url).origin;
const serviceHeaders = { 'OAI-Sites-Authorization': `Bearer ${bearer}` };
const statusResponse = await fetch(origin + '/api/ai/status', {
  headers: serviceHeaders,
  redirect: 'manual',
  signal: AbortSignal.timeout(30000),
});
if (statusResponse.status !== 200)
  throw new Error(`Hosted API status returned ${statusResponse.status}`);
const status = await statusResponse.json();
if (!status.configured || !status.hosted) throw new Error('Hosted AI service is not configured.');
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  page.setDefaultTimeout(150000);
  // Restrict the service credential to this Site; never attach it to font or other origins.
  await page.route(origin + '/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), ...serviceHeaders } }),
  );
  await page.goto(origin);
  await expect(page.getByRole('button', { name: '导入我的单词' })).toBeVisible();
  await page.getByRole('button', { name: '导入我的单词' }).click();
  await page.getByLabel('词库名称', { exact: true }).fill('上线验证 · 合成词库');
  await page.getByLabel('你的学习材料').fill('en bok - 书\näta - 吃\nfika - 喝咖啡小憩');
  await page.getByLabel('材料类型', { exact: true }).selectOption('vocabulary');
  await page.getByRole('checkbox', { name: /同意将本次材料文字/ }).check();
  const wait = page.waitForResponse((r) => r.url() === origin + '/api/ai/extract');
  await page.getByRole('button', { name: '用 AI 整理', exact: true }).click();
  const response = await wait;
  if (response.status() !== 200)
    throw new Error(
      `Hosted extraction returned ${response.status()}: ${JSON.stringify(await response.json())}`,
    );
  await expect(page.getByRole('heading', { name: '确认你的单词' })).toBeVisible();
  const rows = await page.getByRole('textbox', { name: '瑞典语词条', exact: true }).count();
  if (rows < 3) throw new Error('Expected three synthetic vocabulary entries.');
  await page.getByRole('button', { name: '保存词库', exact: true }).click();
  await page.getByRole('button', { name: '重命名', exact: true }).click();
  await page.getByLabel('新的词库名称').fill('线上功能验证');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await page.getByRole('button', { name: '开始一组练习', exact: true }).click();
  await expect(page.locator('.study-group.chosen')).toHaveCount(1);
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.getByRole('button', { name: '准备好了，开始' })).toBeVisible();
  console.log(
    JSON.stringify({
      url: origin,
      configured: true,
      model: status.model,
      extractedWords: rows,
      verified: [
        'online homepage',
        'real AI import',
        'custom name',
        'rename',
        'fixed groups',
        'practice intro',
      ],
    }),
  );
} finally {
  await browser.close();
}
