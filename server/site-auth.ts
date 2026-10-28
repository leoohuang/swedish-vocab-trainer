import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
const TTL = 7 * 86400000;
const COOKIE = 'ord_session';
function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
function loginPage(error = '') {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录 · ord.</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f6f5ef;color:#253c32;font-family:system-ui,-apple-system,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}.card{width:100%;max-width:430px;background:#fffef9;border:1px solid #dfe3d8;border-radius:20px;padding:36px}.logo{font-family:Georgia,serif;font-size:50px;font-weight:700;margin-bottom:32px}h1{font-size:26px;margin:0 0 12px}p{font-size:14px;line-height:1.8;color:#67756b}label{display:block;font-size:14px;margin:24px 0 8px}input{width:100%;padding:14px;border:1px solid #c9d2c5;border-radius:9px;font:inherit;background:white}input:focus{outline:2px solid #456e53;outline-offset:2px}button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:9px;background:#315940;color:white;font:inherit;cursor:pointer}.error{color:#a43c35}.note{margin-top:26px;font-size:12px}</style><main class="card"><div class="logo">ord.</div><h1>继续你的瑞典语练习</h1><p>输入你为这个网站设置的访问密码。</p>${error ? `<p role="alert" class="error">${error}</p>` : ''}<form action="/login" method="post"><input type="hidden" name="username" value="ord" autocomplete="username"><label for="password">网站访问密码</label><input id="password" type="password" name="password" autocomplete="current-password" required maxlength="1024"><button type="submit">进入词库</button></form><p class="note">词库和学习进度保存在当前浏览器。首次使用这个网址时，可合并导入之前的词库备份。</p></main></html>`;
}
export function createSiteAuth(password: string, origin: string, now = Date.now) {
  const secure = origin.startsWith('https://') ? '; Secure' : '';
  const sign = (value: string) =>
    createHmac('sha256', password)
      .update('ord-session-v1:' + value)
      .digest('base64url');
  const failures: number[] = [];
  const page = (res: ServerResponse, status = 200, error = '') => {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'same-origin',
    });
    res.end(loginPage(error));
  };
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    try {
      if (!password) {
        next();
        return;
      }
      const path = req.url?.split('?')[0];
      const cookie =
        req.headers.cookie
          ?.split(';')
          .map((s) => s.trim())
          .find((s) => s.startsWith(COOKIE + '='))
          ?.slice(COOKIE.length + 1) || '';
      const [expires, nonce, signature, extra] = cookie.split('.');
      const validCookie =
        !extra &&
        !!nonce &&
        !!signature &&
        /^\d+$/.test(expires || '') &&
        Number(expires) > now() &&
        equal(signature, sign(`${expires}.${nonce}`));
      if (path === '/login' && req.method === 'POST') {
        if (!req.headers.origin || new URL(req.headers.origin).origin !== new URL(origin).origin) {
          page(res, 403, '请从当前网站的登录页面提交。');
          return;
        }
        if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
          page(res, 415, '请使用登录表单。');
          return;
        }
        while (failures.length && failures[0] <= now() - 60000) failures.shift();
        if (failures.length >= 10) {
          page(res, 429, '尝试次数过多，请一分钟后再试。');
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8192) {
            page(res, 413, '登录内容过长，请重新输入。');
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        const fields = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        if (fields.get('username') !== 'ord' || !equal(fields.get('password') || '', password)) {
          failures.push(now());
          page(res, 401, '密码不正确，请再试一次。');
          return;
        }
        const value = `${now() + TTL}.${randomBytes(18).toString('base64url')}`;
        res
          .writeHead(303, {
            Location: '/',
            'Cache-Control': 'no-store',
            'Set-Cookie': `${COOKIE}=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL / 1000}${secure}`,
          })
          .end();
        return;
      }
      if (validCookie) {
        next();
        return;
      }
      if (path?.startsWith('/api/')) {
        res
          .writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          .end(JSON.stringify({ error: '请先使用网站访问密码登录。' }));
        return;
      }
      page(res);
    } catch {
      if (!res.headersSent) page(res, 400, '无法完成登录，请返回首页重试。');
      else if (!res.writableEnded) res.end();
    }
  };
}
