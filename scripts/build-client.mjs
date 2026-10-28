import { spawn } from 'node:child_process';
// Bound native worker pools for small servers and desktop builds.
const env = {
  ...process.env,
  ROLLDOWN_WORKER_THREADS: process.env.ROLLDOWN_WORKER_THREADS || '2',
  RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS || '2',
  UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || '32',
};
for (const args of [
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  if (code !== 0) process.exit(code);
}
