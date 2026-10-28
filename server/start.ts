import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createAiHandler, publicSiteOrigin } from './ai.ts';
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const password = process.env.SITE_PASSWORD || '';
const publicOrigin = publicSiteOrigin();
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && (!publicOrigin || !password))
  throw new Error('独立网站需要设置 PUBLIC_ORIGIN 和 SITE_PASSWORD；本机运行无需设置。');
const root = resolve(process.env.ASSET_DIR || 'dist'),
  handler = createAiHandler();
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
createServer((req, res) => {
  // Health checks reveal no configuration or vocabulary and do not invoke the model.
  if (req.url === '/healthz' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  if (password) {
    const header = req.headers.authorization || '';
    const supplied = header.startsWith('Basic ')
      ? Buffer.from(header.slice(6), 'base64').toString('utf8')
      : '';
    const valid =
      supplied.startsWith('ord:') &&
      timingSafeEqual(
        createHash('sha256').update(supplied.slice(4)).digest(),
        createHash('sha256').update(password).digest(),
      );
    if (!valid) {
      res
        .writeHead(401, {
          'WWW-Authenticate': 'Basic realm="ord", charset="UTF-8"',
          'Cache-Control': 'no-store',
        })
        .end('Please sign in with your ord website password.');
      return;
    }
  }
  void handler(req, res, () => {
    void (async () => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        const pathname = decodeURIComponent(url.pathname);
        if (
          pathname.split('/').some((part) => part.startsWith('.') || part === 'server') ||
          (pathname !== '/' && pathname !== '/index.html' && !pathname.startsWith('/assets/'))
        ) {
          res.writeHead(404).end();
          return;
        }
        const file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep) && file !== root) {
          res.writeHead(403).end();
          return;
        }
        if (pathname.startsWith('/api/')) {
          res.writeHead(404).end();
          return;
        }
        let target = file;
        try {
          if (!(await stat(target)).isFile()) target = resolve(root, 'index.html');
        } catch {
          target = resolve(root, 'index.html');
        }
        res.setHeader('Content-Type', types[extname(target)] || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
          'Cache-Control',
          pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store',
        );
        res.end(await readFile(target));
      } catch {
        res.writeHead(500).end('Unable to serve app. Run npm run build first.');
      }
    })();
  });
}).listen(port, host, () => console.log(`ord. → ${publicOrigin || `http://${host}:${port}`}`));
