import { expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAiHandler } from '../server/ai';
const payload = { topic: 'synthetic topic', sfiLevel: 'B', count: 5, consent: true };
const output = {
  detectedMode: 'vocabulary',
  words: [
    {
      term: 'en bok',
      meaning: '书',
      note: '',
      example: 'Jag läser en bok.',
      exampleTranslation: '我读一本书。',
      reason: 'synthetic',
      blockId: '',
      quote: '',
      meaningOrigin: 'ai',
      needsReview: false,
      priority: 5,
    },
  ],
  unresolved: [],
};
async function serverFor(
  run: (
    base: string,
    getConfig: ReturnType<typeof vi.fn>,
    fetcher: ReturnType<typeof vi.fn>,
  ) => Promise<void>,
) {
  const getConfig = vi.fn(() => ({
    key: 'OWNER-KEY-MUST-NEVER-BE-USED',
    model: 'owner-model',
    baseURL: 'https://api.openai.com/v1',
    style: 'responses' as const,
  }));
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify(
        body.input
          ? {
              status: 'completed',
              output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
            }
          : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] },
      ),
    );
  });
  const handler = createAiHandler(getConfig, fetcher, '', { byokOnly: true });
  const server = createServer((req, res) => void handler(req, res, () => res.writeHead(404).end()));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await run(base, getConfig, fetcher);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
const personal = (
  key = 'SYNTHETIC-VISITOR-A',
  model = 'visitor-model',
  baseURL = 'https://api.openai.com/v1',
  style = 'responses',
) => ({
  'X-Ord-AI-Key': key,
  'X-Ord-AI-Model': model,
  'X-Ord-AI-URL': baseURL,
  'X-Ord-AI-Style': style,
});
const post = (base: string, headers = {}) =>
  fetch(base + '/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
    body: JSON.stringify(payload),
  });
it('公开状态不加载站长密钥；无用户密钥时拒绝调用，不能用空密钥回退', async () => {
  await serverFor(async (base, getConfig, fetcher) => {
    const status = await (await fetch(base + '/api/ai/status')).json();
    expect(status).toMatchObject({ configured: false, byokOnly: true, supportsUserKey: true });
    expect((await post(base)).status).toBe(401);
    expect((await post(base, personal(''))).status).toBe(400);
    expect(getConfig).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
it('并发访客的密钥、模型、地址和接口格式保持各自独立，不泄漏到响应', async () => {
  await serverFor(async (base, getConfig, fetcher) => {
    const results = await Promise.all([
      post(base, personal()),
      post(
        base,
        personal('SYNTHETIC-VISITOR-B', 'another-model', 'https://api.vendor.com/v1', 'chat'),
      ),
    ]);
    for (const response of results) {
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).not.toContain('SYNTHETIC-VISITOR');
      expect(body).not.toContain('OWNER-KEY');
    }
    expect(fetcher.mock.calls.map((args) => String(args[0])).sort()).toEqual([
      'https://api.openai.com/v1/responses',
      'https://api.vendor.com/v1/chat/completions',
    ]);
    const calls = fetcher.mock.calls.map((args) => ({
      headers: args[1]?.headers as Record<string, string>,
      body: JSON.parse(String(args[1]?.body)),
    }));
    expect(calls.find((c) => c.body.model === 'visitor-model')?.headers.Authorization).toBe(
      'Bearer SYNTHETIC-VISITOR-A',
    );
    expect(calls.find((c) => c.body.model === 'another-model')?.headers.Authorization).toBe(
      'Bearer SYNTHETIC-VISITOR-B',
    );
    expect(getConfig).not.toHaveBeenCalled();
  });
});
it('无效的自定义目的地址和配置在发送密钥前被拒绝', async () => {
  await serverFor(async (base, getConfig, fetcher) => {
    for (const url of [
      'http://api.vendor.com/v1',
      'https://localhost/v1',
      'https://127.0.0.1/v1',
      'https://2130706433/v1',
      'https://[::1]/v1',
      'https://api.vendor.com:8443/v1',
      'https://user:secret@api.vendor.com/v1',
      'https://api.vendor.com/v1?api_key=secret',
    ])
      expect((await post(base, personal('test', 'test', url))).status, url).toBe(400);
    expect((await post(base, personal('test', 'model with spaces'))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(getConfig).not.toHaveBeenCalled();
  });
});
it('公开请求不能通过额外请求体字段选用站长的密钥', async () => {
  await serverFor(async (base, getConfig, fetcher) => {
    const response = await fetch(base + '/api/ai/generate', {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, useServerKey: true, connection: { key: 'spoofed' } }),
    });
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    expect(getConfig).not.toHaveBeenCalled();
  });
});
