import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSiteAuth } from '../server/site-auth';
it('独立登录会话可过期、拒绝伪造 cookie、限制猜测，HTTPS 设置安全 cookie', async () => {
  let now = Date.now();
  const origin = 'https://words.example.com';
  const auth = createSiteAuth('synthetic-密码', origin, () => now);
  const server = createServer((req, res) => {
    void auth(req, res, () => res.end('private'));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const login = (password: string, source = origin) =>
    fetch(base + '/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { origin: source, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'ord', password }),
    });
  try {
    const page = await fetch(base);
    expect(page.headers.has('www-authenticate')).toBe(false);
    expect(await page.text()).toContain('网站访问密码');
    const result = await login('synthetic-密码');
    expect(result.status).toBe(303);
    const cookie = result.headers.get('set-cookie')!;
    expect(cookie).toContain('; Secure');
    expect(cookie).toContain('; HttpOnly');
    const headers = { cookie: cookie.split(';')[0] };
    expect(await (await fetch(base, { headers })).text()).toBe('private');
    expect(
      (await fetch(base + '/api/ai/status', { headers: { cookie: headers.cookie + 'x' } })).status,
    ).toBe(401);
    now += 8 * 86400000;
    expect((await fetch(base + '/api/ai/status', { headers })).status).toBe(401);
    expect((await login('synthetic-密码', 'https://elsewhere.example')).status).toBe(403);
    for (let i = 0; i < 10; i++) expect((await login('wrong')).status).toBe(401);
    expect((await login('synthetic-密码')).status).toBe(429);
    now += 60001;
    expect((await login('synthetic-密码')).status).toBe(303);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
