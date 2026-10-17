import { readFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { build } from 'esbuild';
const root = join(process.cwd(), 'dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const assets = {};
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'server' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collect(path);
    else {
      const type = types[extname(path)];
      if (!type) throw new Error(`Unsupported client asset type: ${extname(path)}`);
      assets['/' + relative(root, path).split('\\').join('/')] = {
        body: await readFile(path, 'utf8'),
        type,
      };
    }
  }
}
await collect(root);
if (!assets['/index.html']) throw new Error('Build the client first.');
await mkdir(join(root, 'server'), { recursive: true });
await build({
  entryPoints: ['worker/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  plugins: [
    {
      name: 'embedded-client',
      setup(build) {
        build.onResolve({ filter: /^virtual:ord-assets$/ }, () => ({
          path: 'ord-assets',
          namespace: 'ord',
        }));
        build.onLoad({ filter: /.*/, namespace: 'ord' }, () => ({
          contents: `export default ${JSON.stringify(assets)}`,
          loader: 'js',
        }));
      },
    },
  ],
});
await mkdir(join(root, '.openai'), { recursive: true });
await copyFile('.openai/hosting.json', join(root, '.openai/hosting.json'));
console.log(`Built hosted Worker with ${Object.keys(assets).length} embedded client assets.`);
