import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createSiteAuth } from './site-auth.ts';
import { createAiHandler, publicSiteOrigin } from './ai.ts';
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const password = process.env.SITE_PASSWORD || '';
const publicOrigin = publicSiteOrigin();
const publicAccess = process.env.SITE_ACCESS_MODE !== 'private';
if (
  !['127.0.0.1', 'localhost', '::1'].includes(host) &&
  (!publicOrigin || (!publicAccess && !password))
)
  throw new Error('独立网站需要 PUBLIC_ORIGIN；私有模式还需要 SITE_PASSWORD。');
const authorize = createSiteAuth(password, publicOrigin || `http://${host}:${port}`);
const root = resolve(process.env.ASSET_DIR || 'dist'),
  handler = createAiHandler(undefined, undefined, publicOrigin, { byokOnly: publicAccess });
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
  const serve = () => {
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
          res.setHeader('Referrer-Policy', 'no-referrer');
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          );
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
  };
  if (publicAccess) serve();
  else void authorize(req, res, serve);
}).listen(port, host, () => console.log(`ord. → ${publicOrigin || `http://${host}:${port}`}`));
