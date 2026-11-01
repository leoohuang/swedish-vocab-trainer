import { describe, it, expect, vi } from 'vitest';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { aiRequest, modelResult } from '../shared/ai';
import type { AiRequest, ModelResult } from '../shared/ai';
import {
  AiError,
  callModel,
  chunksFor,
  createAiHandler,
  extractVocabulary,
  groundResults,
  promptFor,
  publicSiteOrigin,
} from '../server/ai';
import { materialBlocks, readMaterial } from '../src/parser';
import { emptyData } from '../src/model';
import { validateData } from '../src/storage';
const config = {
  key: 'test-placeholder-never-a-real-key',
  model: 'test-model',
  baseURL: 'https://api.openai.com/v1',
  style: 'responses' as const,
};
const blocks = [
  { id: 'b1', text: 'Jag åt frukost.\näta / 吃 / åt / ätit', location: '课堂笔记 · 第 1 页' },
];
const request: AiRequest = {
  blocks,
  mode: 'auto',
  level: 'beginner',
  count: 5,
  knownTerms: [],
  consent: true,
};
function word(patch: Partial<ModelResult['words'][number]> = {}): ModelResult['words'][number] {
  return {
    term: 'äta',
    meaning: '吃',
    note: 'åt · ätit',
    example: 'Jag åt frukost.',
    exampleTranslation: '我吃了早餐。',
    reason: '日常常用动词；文中出现过去式。',
    blockId: 'b1',
    quote: 'Jag åt frukost.',
    meaningOrigin: 'ai',
    needsReview: false,
    priority: 5,
    ...patch,
  };
}
function result(patch: Partial<ModelResult> = {}): ModelResult {
  return { detectedMode: 'article', words: [word()], unresolved: [], ...patch };
}
function upstream(value: ModelResult) {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
        }),
        { status: 200 },
      ),
  );
}
async function withServer(
  run: (base: string, fetcher: ReturnType<typeof upstream>) => Promise<void>,
  cfg = config,
  publicOrigin = '',
) {
  const fetcher = upstream(result());
  const handler = createAiHandler(() => cfg, fetcher, publicOrigin, { byokOnly: false });
  const server = createServer((req, res) => {
    void handler(req, res, () => {
      res.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await run(base, fetcher);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
describe('原始材料与来源', () => {
  it('保留连续课文，不先拆成待补释义词条', () => {
    const text = 'På morgonen åt jag frukost.\nSedan gick jag till skolan.';
    const [b] = materialBlocks(text, 'lesson.txt');
    expect(b.text).toBe(text);
    expect(b.location).toContain('lesson.txt');
  });
  it('长材料分段但不丢字符，并限制一次请求体积', () => {
    const text = 'Jag läser en bok.\n'.repeat(1000);
    const b = materialBlocks(text);
    expect(b.map((x) => x.text).join('')).toBe(text);
    expect(b.every((x) => x.text.length <= 5000)).toBe(true);
    expect(chunksFor(b).length).toBeGreaterThan(1);
    expect(() => materialBlocks('a'.repeat(30001))).toThrow('30000');
    expect(aiRequest.safeParse({ ...request, consent: false }).success).toBe(false);
  });
  it('TXT 进入 AI 前保留原文和文件名', async () => {
    const file = new File(['Jag åt frukost.'], 'lesson.txt');
    expect((await readMaterial(file))[0]).toMatchObject({ text: 'Jag åt frukost.' });
  });
  it('真实引文、原句与 AI 释义标记一起保存到备份', () => {
    const [d] = groundResults(result(), blocks);
    expect(d.source).toBe('Jag åt frukost.');
    expect(d.ai?.meaningOrigin).toBe('ai');
    expect(d.selected).toBe(true);
    const data = emptyData();
    data.decks.push({ id: 'deck', name: 'lesson', created: 1, pending: [d] });
    data.words.push({ ...d, deckId: 'deck', favorite: false, due: null, interval: 0, sessions: 0 });
    const restored = validateData(JSON.parse(JSON.stringify(data)));
    expect(restored.words[0].ai?.example).toBe('Jag åt frukost.');
    expect(restored.decks[0].pending[0].ai?.reason).toContain('日常');
  });
  it('虚构引文不默认进入练习，虚构例句不标为原文', () => {
    const [d] = groundResults(
      result({ words: [word({ quote: '不存在的引文', example: 'Det är kallt.' })] }),
      blocks,
    );
    expect(d.selected).toBe(false);
    expect(d.issue).toContain('引用未匹配');
    expect(d.source).toBe(blocks[0].text);
    expect(d.ai?.example).toBe('');
    expect(() =>
      groundResults(result({ words: [word({ blockId: 'imaginary' })] }), blocks),
    ).toThrow('来源编号');
  });
  it('模型声称原文释义但无逐字依据时标为 AI 补充', () => {
    const [d] = groundResults(
      result({ words: [word({ meaningOrigin: 'source', meaning: '吃早餐' })] }),
      blocks,
    );
    expect(d.ai?.meaningOrigin).toBe('ai');
  });
});
describe('模式与模型调用', () => {
  it('完整词汇合集不会被课文目标数删减', async () => {
    const words = Array.from({ length: 9 }, (_, i) =>
      word({ term: `ord${i}`, meaning: `含义${i}` }),
    );
    const output = await extractVocabulary(
      { ...request, mode: 'vocabulary', count: 5 },
      config,
      upstream(result({ detectedMode: 'vocabulary', words })),
    );
    expect(output.drafts.filter((d) => d.selected)).toHaveLength(9);
    expect(promptFor({ ...request, mode: 'vocabulary' }, blocks)).toContain(
      '不按水平和目标数量删减',
    );
  });
  it('课文目标数只影响推荐勾选，候补保留且已学词被排除', async () => {
    const words = Array.from({ length: 9 }, (_, i) =>
      word({ term: `ord${i}`, meaning: `含义${i}`, priority: i === 8 ? 5 : 1 }),
    );
    const output = await extractVocabulary(
      { ...request, mode: 'article', count: 5, knownTerms: ['ord0'] },
      config,
      upstream(result({ words })),
    );
    expect(output.drafts.filter((d) => d.selected)).toHaveLength(5);
    expect(output.drafts).toHaveLength(8);
    expect(output.drafts.some((d) => d.term === 'ord0')).toBe(false);
    expect(output.drafts.find((d) => d.term === 'ord8')?.selected).toBe(true);
    expect(output.skippedKnown).toBe(1);
  });
  it('Responses 使用结构化输出、关闭存储，密钥只进服务端请求头', async () => {
    const fetcher = upstream(result());
    await callModel(config, request, blocks, fetcher);
    const args = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(args[1].body as string);
    expect(args[0]).toBe('https://api.openai.com/v1/responses');
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.input[1].content).toContain('原文片段');
    expect(args[1].body).not.toContain(config.key);
  });
  it('不完整输出、坏 JSON、服务限流不产生半成品词库', async () => {
    await expect(
      callModel(
        config,
        request,
        blocks,
        async () => new Response(JSON.stringify({ status: 'incomplete', output: [] })),
      ),
    ).rejects.toThrow('未完整返回');
    await expect(
      callModel(
        config,
        request,
        blocks,
        async () =>
          new Response(
            JSON.stringify({
              status: 'completed',
              output: [{ content: [{ type: 'output_text', text: 'bad json' }] }],
            }),
          ),
      ),
    ).rejects.toThrow('格式不完整');
    await expect(
      callModel(
        config,
        request,
        blocks,
        async () => new Response('private upstream body', { status: 429 }),
      ),
    ).rejects.toThrow('额度不足');
  });
  it('缺密钥和已取消请求不会调用模型', async () => {
    const fetcher = upstream(result());
    await expect(
      extractVocabulary(request, { ...config, key: '' }, fetcher),
    ).rejects.toBeInstanceOf(AiError);
    const controller = new AbortController();
    controller.abort();
    await expect(extractVocabulary(request, config, fetcher, controller.signal)).rejects.toThrow(
      '取消',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('兼容 Chat Completions 可配置且仍验证结构', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result()) } }],
          }),
        ),
    );
    await expect(
      callModel({ ...config, style: 'chat' }, request, blocks, fetcher),
    ).resolves.toMatchObject({ detectedMode: 'article' });
    const args = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(args[0]).toContain('/chat/completions');
    expect(JSON.parse(args[1].body as string).response_format.json_schema.strict).toBe(true);
  });
});
describe('本机服务接口', () => {
  it('真实 HTTP 路径完成请求但不暴露配置密钥', async () => {
    await withServer(async (base, upstream) => {
      const status = await (await fetch(`${base}/api/ai/status`)).text();
      expect(status).toContain('configured');
      expect(status).not.toContain(config.key);
      const res = await fetch(`${base}/api/ai/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify(request),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).drafts[0].term).toBe('äta');
      expect(upstream).toHaveBeenCalledOnce();
    });
  });
  it('未授权、跨站与密钥缺失不会发送学习材料', async () => {
    await withServer(async (base, upstream) => {
      const denied = await fetch(`${base}/api/ai/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://external.example' },
        body: JSON.stringify(request),
      });
      expect(denied.status).toBe(403);
      const missing = await fetch(`${base}/api/ai/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, consent: false }),
      });
      expect(missing.status).toBe(400);
      expect(upstream).not.toHaveBeenCalled();
    });
    await withServer(
      async (base, upstream) => {
        const res = await fetch(`${base}/api/ai/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
        expect(res.status).toBe(503);
        expect(upstream).not.toHaveBeenCalled();
      },
      { ...config, key: '' },
    );
  });
});

describe('模型权限与安全错误提示', () => {
  const failure = (status: number, code: string, message: string) => async () =>
    new Response(JSON.stringify({ error: { code, message } }), { status });
  it('组织未认证的 404 不能误报为密钥未配置或笼统服务失败', async () => {
    await expect(
      callModel(
        config,
        request,
        blocks,
        failure(404, 'model_not_found', 'Your organization must be verified to use the model.'),
      ),
    ).rejects.toThrow('组织认证');
  });
  it('区分模型无权限、API 余额和接口地址错误', async () => {
    await expect(
      callModel(config, request, blocks, failure(404, 'model_not_found', 'Not available')),
    ).rejects.toThrow('模型不存在或当前密钥没有访问权限');
    await expect(
      callModel(config, request, blocks, failure(429, 'insufficient_quota', 'Quota exhausted')),
    ).rejects.toThrow('账户额度不足');
    await expect(callModel(config, request, blocks, failure(404, '', 'Not found'))).rejects.toThrow(
      '接口地址未找到',
    );
  });
  it('不向浏览器转发包含密钥的上游错误原文', async () => {
    let message = '';
    try {
      await callModel(
        config,
        request,
        blocks,
        failure(401, 'invalid_api_key', `Invalid key ${config.key}`),
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('密钥无效');
    expect(message).not.toContain(config.key);
  });
});

async function hostedRequest(url: string, headers: Record<string, string>, body?: string) {
  return new Promise<{ status: number; text: () => Promise<string> }>((resolve, reject) => {
    const req = httpRequest(url, { method: body ? 'POST' : 'GET', headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        text += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode!, text: async () => text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
describe('独立网站的 AI 来源限制', () => {
  it('读取平台实际分配的网址，自定义域名设置优先', () => {
    expect(publicSiteOrigin({})).toBe('');
    expect(publicSiteOrigin({ RENDER_EXTERNAL_URL: 'https://assigned.onrender.com' })).toBe(
      'https://assigned.onrender.com',
    );
    expect(
      publicSiteOrigin({
        RENDER_EXTERNAL_URL: 'https://assigned.onrender.com',
        PUBLIC_ORIGIN: 'https://words.example.com',
      }),
    ).toBe('https://words.example.com');
  });
  it('只接受配置的独立域名，不要求 ChatGPT 登录', async () => {
    await withServer(
      async (base, fetcher) => {
        const headers = {
          host: 'words.example.com',
          origin: 'https://words.example.com',
          'content-type': 'application/json',
        };
        const status = await hostedRequest(`${base}/api/ai/status`, headers);
        expect(status.status).toBe(200);
        expect(await status.text()).not.toContain(config.key);
        const response = await hostedRequest(
          `${base}/api/ai/extract`,
          headers,
          JSON.stringify(request),
        );
        expect(response.status).toBe(200);
        expect(fetcher).toHaveBeenCalledOnce();
      },
      config,
      'https://words.example.com',
    );
  });
  it('拒绝未知主机、跨站来源、同域 HTTP 降级和缺少来源的整理请求', async () => {
    await withServer(
      async (base, fetcher) => {
        for (const headers of [
          { host: 'wrong.example.com', origin: 'https://words.example.com' },
          { host: 'words.example.com', origin: 'https://other.example.com' },
          { host: 'words.example.com', origin: 'http://words.example.com' },
          { host: 'words.example.com' },
        ]) {
          const response = await hostedRequest(
            `${base}/api/ai/extract`,
            { ...headers, 'content-type': 'application/json' } as Record<string, string>,
            JSON.stringify(request),
          );
          expect(response.status).toBe(403);
        }
        expect(fetcher).not.toHaveBeenCalled();
      },
      config,
      'https://words.example.com',
    );
  });
});
