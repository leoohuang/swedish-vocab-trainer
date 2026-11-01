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
  *{box-sizing:border-box}body{margin:0;background:#f6f5ef;color:#253c32;font-family:system-ui,-apple-system,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}.card{width:100%;max-width:430px;background:#fffef9;border:1px solid #dfe3d8;border-radius:20px;padding:36px}.logo{font-family:Georgia,serif;font-size:50px;font-weight:700;margin-bottom:32px}h1{font-size:26px;margin:0 0 12px}p{font-size:14px;line-height:1.8;color:#67756b}label{display:block;font-size:14px;margin:24px 0 8px}input{width:100%;padding:14px;border:1px solid #c9d2c5;border-radius:9px;font:inherit;background:white}input:focus{outline:2px solid #456e53;outline-offset:2px}button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:9px;background:#315940;color:white;font:inherit;cursor:pointer}.error{color:#a43c35}.note{margin-top:26px;font-size:12px}.login-languages{display:flex;justify-content:flex-end;gap:5px}.login-languages button{width:auto;margin:0;padding:6px 10px;font-size:12px;background:#edf1e8;color:#315940}.login-languages button[aria-pressed=true]{background:#315940;color:white}</style><main class="card"><div class="login-languages" role="group" aria-label="Language"><button type="button" data-language="zh">中文</button><button type="button" data-language="en">EN</button></div><div class="logo">ord.</div><h1 data-copy="title">继续你的瑞典语练习</h1><p data-copy="intro">输入你为这个网站设置的访问密码。</p>${error ? `<p role="alert" class="error" data-error="true">${error}</p>` : ''}<form action="/login" method="post"><input type="hidden" name="username" value="ord" autocomplete="username"><label for="password" data-copy="password">网站访问密码</label><input id="password" type="password" name="password" autocomplete="current-password" required maxlength="1024"><button type="submit" data-copy="enter">进入词库</button></form><p class="note" data-copy="note">词库和学习进度保存在当前浏览器。首次使用这个网址时，可合并导入之前的词库备份。</p></main><script>
  (() => {
    const copy = {
      zh: { title: '继续你的瑞典语练习', intro: '输入你为这个网站设置的访问密码。', password: '网站访问密码', enter: '进入词库', note: '词库和学习进度保存在当前浏览器。首次使用这个网址时，可合并导入之前的词库备份。' },
      en: { title: 'Continue your Swedish practice', intro: 'Enter the access password set for this website.', password: 'Website access password', enter: 'Open my decks', note: 'Decks and progress are stored in this browser. You can merge an earlier backup when using this website for the first time.' }
    };
    const errors = { '密码不正确，请再试一次。': 'Incorrect password. Please try again.', '请从当前网站的登录页面提交。': 'Submit from this website’s login page.', '请使用登录表单。': 'Please use the login form.', '登录内容过长，请重新输入。': 'Login data is too long. Please try again.', '尝试次数过多，请一分钟后再试。': 'Too many attempts. Please try again in one minute.', '无法完成登录，请返回首页重试。': 'Could not sign in. Return to the home page and retry.' };
    const error = document.querySelector('[data-error]');
    const originalError = error ? error.textContent : '';
    function choose(lang) {
      document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
      document.title = lang === 'en' ? 'Sign in · ord.' : '登录 · ord.';
      document.querySelectorAll('[data-copy]').forEach(el => { el.textContent = copy[lang][el.dataset.copy]; });
      document.querySelectorAll('[data-language]').forEach(el => { el.setAttribute('aria-pressed', String(el.dataset.language === lang)); });
      if(error) error.textContent = lang === 'en' ? errors[originalError] || originalError : originalError;
      try { localStorage.setItem('ord-language', lang); } catch {}
    }
    document.querySelectorAll('[data-language]').forEach(el => el.addEventListener('click', () => choose(el.dataset.language)));
    let lang = 'zh'; try { if(localStorage.getItem('ord-language') === 'en') lang = 'en'; } catch {}
    choose(lang);
  })();
  </script></html>`;
}
export function createSiteAuth(password: string, origin: string, now = Date.now) {
  const secure = origin.startsWith('https://') ? '; Secure' : '';
  const sign = (value: string) =>
    createHmac('sha256', password)
      .update('ord-session-v1:' + value)
      .digest('base64url');
  const failures: number[] = [];
  const page = (res: ServerResponse, status = 200, error = '') => {
    const html = loginPage(error);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
    const scriptHash = createHash('sha256').update(script).digest('base64');
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
      'Referrer-Policy': 'same-origin',
    });
    res.end(html);
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
