import { describe, it, expect, vi } from 'vitest';
import { createWorkerHandler } from '../worker/handler';
const origin = 'https://ord.example';
const request = {
  blocks: [{ id: 'b1', text: 'en bok - 书', location: '合成线上样本' }],
  mode: 'vocabulary',
  level: 'beginner',
  count: 5,
  knownTerms: [],
  consent: true,
};
const model = {
  detectedMode: 'vocabulary',
  words: [
    {
      term: 'en bok',
      meaning: '书',
      note: '',
      example: '',
      exampleTranslation: '',
      reason: '材料中的词条',
      blockId: 'b1',
      quote: 'en bok - 书',
      meaningOrigin: 'source',
      needsReview: false,
      priority: 5,
    },
  ],
  unresolved: [],
};
const env = { OPENAI_API_KEY: 'synthetic-key-for-tests', OPENAI_MODEL: 'test-model' };
const assets = {
  '/index.html': { body: '<!doctype html><title>ord.</title>', type: 'text/html' },
  '/assets/app.js': { body: 'console.log("ord")', type: 'text/javascript' },
};
const post = (patch = {}, headers = {}) =>
  new Request(origin + '/api/ai/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
    body: JSON.stringify({ ...request, ...patch }),
  });
describe('Hosted Worker', () => {
  it('服务页面、脚本与 HEAD，未知路径不返回源码', async () => {
    const handler = createWorkerHandler(assets);
    expect(await (await handler(new Request(origin), env)).text()).toContain('ord.');
    const script = await handler(new Request(origin + '/assets/app.js'), env);
    expect(script.headers.get('Content-Type')).toBe('text/javascript');
    expect(script.headers.get('Cache-Control')).toContain('private');
    expect((await handler(new Request(origin + '/.env.local'), env)).status).toBe(404);
    expect(await (await handler(new Request(origin, { method: 'HEAD' }), env)).text()).toBe('');
  });
  it('从 Worker 环境读取配置，不泄露密钥', async () => {
    const handler = createWorkerHandler(assets);
    const response = await handler(new Request(origin + '/api/ai/status'), env);
    const body = await response.text();
    expect(body).toContain('"configured":true');
    expect(body).toContain('"hosted":true');
    expect(body).not.toContain(env.OPENAI_API_KEY);
  });
  it('云端来源下调用模型并核对引文，无本机主机限制', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'completed',
            output: [{ content: [{ type: 'output_text', text: JSON.stringify(model) }] }],
          }),
        ),
    );
    const handler = createWorkerHandler(assets, fetcher);
    const r = await handler(post(), env);
    expect(r.status).toBe(200);
    expect((await r.json()).drafts[0]).toMatchObject({
      term: 'en bok',
      meaning: '书',
      selected: true,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('拒绝跨站、缺授权、超大内容和错误方法', async () => {
    const fetcher = vi.fn();
    const handler = createWorkerHandler(assets, fetcher);
    expect((await handler(post({}, { Origin: 'https://external.example' }), env)).status).toBe(403);
    expect((await handler(post({ consent: false }), env)).status).toBe(400);
    expect((await handler(post({}, { 'Content-Length': '300000' }), env)).status).toBe(413);
    expect((await handler(new Request(origin + '/api/ai/extract'), env)).status).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('未配置密钥时不调用模型，支持服务端取消与错误反馈', async () => {
    const fetcher = vi.fn();
    const handler = createWorkerHandler(assets, fetcher);
    expect((await handler(post(), {})).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    const bad = createWorkerHandler(
      assets,
      async () =>
        new Response(JSON.stringify({ error: { code: 'insufficient_quota' } }), { status: 429 }),
    );
    const r = await bad(post(), env);
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain('额度不足');
  });
});
