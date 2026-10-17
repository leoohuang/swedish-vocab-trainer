import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createAiHandler } from './server/ai.ts';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ord-ai-server',
      configureServer(server) {
        server.middlewares.use(createAiHandler());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createAiHandler());
      },
    },
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
