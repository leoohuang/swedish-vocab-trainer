import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createAiHandler } from './ai.ts';
const port = Number(process.env.PORT || 5173);
const root = resolve('dist'),
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
  void handler(req, res, () => {
    void (async () => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        const pathname = decodeURIComponent(url.pathname);
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
        res.end(await readFile(target));
      } catch {
        res.writeHead(500).end('Unable to serve app. Run npm run build first.');
      }
    })();
  });
}).listen(port, '127.0.0.1', () =>
  console.log(`ord. → http://127.0.0.1:${port} (local AI server)`),
);
