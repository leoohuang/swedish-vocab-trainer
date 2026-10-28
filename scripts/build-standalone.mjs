import { cp, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('standalone', { recursive: true });
await cp('dist', 'standalone/client', { recursive: true, force: true });
await build({
  entryPoints: ['server/start.ts'],
  outfile: 'standalone/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
await writeFile(
  'standalone/package.json',
  JSON.stringify(
    {
      private: true,
      type: 'module',
      engines: { node: '>=24' },
      scripts: { start: 'ASSET_DIR=client node server.mjs' },
    },
    null,
    2,
  ) + '\n',
);
console.log('Standalone Node website built in standalone/. No ChatGPT hosting or login required.');
