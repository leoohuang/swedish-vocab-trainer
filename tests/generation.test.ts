import { describe, it, expect, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { topicRequest } from '../shared/ai';
import { generateVocabulary } from '../shared/extraction';
import { topicPrompt } from '../shared/generation';
import { createAiHandler } from '../server/ai';
import { validateData } from '../src/storage';
import { emptyData } from '../src/model';
const config = {
  key: 'synthetic-test-key',
  model: 'test-model',
  baseURL: 'https://model.example/v1',
  style: 'responses' as 'responses' | 'chat',
};
const request = { topic: '看病就医', sfiLevel: 'B' as const, count: 5, consent: true as const };
const word = (term = 'en tid', patch = {}) => ({
  term,
  meaning: '预约时间',
  note: '名词 · tider',
  example: 'Jag vill boka en tid.',
  exampleTranslation: '我想预约一个时间。',
  reason: '就医时常用。',
  blockId: 'invented',
  quote: 'fabricated source',
  meaningOrigin: 'source',
  needsReview: false,
  priority: 5,
  ...patch,
});
function upstream(words = [word()]) {
  return vi.fn(async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    const result = { detectedMode: 'vocabulary', words, unresolved: [] };
    return new Response(
      JSON.stringify(
        body.input
          ? {
              status: 'completed',
              output: [{ content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
            }
          : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] },
      ),
    );
  });
}
describe('按主题生成 SFI 词表', () => {
  it('动词短语去掉不定式标记 att，并按练习词形去重', async () => {
    const result = await generateVocabulary(
      request,
      config,
      upstream([word('att boka en tid'), word('boka en tid')]),
    );
    expect(result.drafts.map((w) => w.term)).toEqual(['boka en tid']);
  });
  it('校验主题、课程、数量和发送同意', () => {
    expect(topicRequest.parse({ ...request, topic: ' 看病就医 ' }).topic).toBe('看病就医');
    for (const patch of [
      { topic: ' ' },
      { topic: 'x'.repeat(161) },
      { sfiLevel: 'C1' },
      { count: 31 },
      { consent: false },
    ])
      expect(topicRequest.safeParse({ ...request, ...patch }).success).toBe(false);
    expect(
      new Set(
        (['A', 'B', 'C', 'D'] as const).map((sfiLevel) => topicPrompt({ ...request, sfiLevel })),
      ).size,
    ).toBe(4);
  });
  it('生成结果不会伪造原文，例句和课程标记可随备份保存', async () => {
    const result = await generateVocabulary(request, config, upstream());
    expect(result.drafts[0]).toMatchObject({
      source: '',
      selected: true,
      ai: { mode: 'generated', meaningOrigin: 'ai', sfiLevel: 'B', topic: '看病就医' },
    });
    const data = emptyData();
    data.decks.push({ id: 'topic', name: '看病就医', created: 1, pending: [] });
    data.words.push({
      ...result.drafts[0],
      deckId: 'topic',
      favorite: false,
      due: null,
      interval: 0,
      sessions: 0,
    });
    expect(validateData(JSON.parse(JSON.stringify(data))).words[0].ai?.mode).toBe('generated');
    expect(result.summary).toContain('1 / 5');
  });
  it('去重、去掉无释义或句子条目，词形不确定时留下人工确认', async () => {
    const result = await generateVocabulary(
      request,
      config,
      upstream([
        word(),
        word('tid'),
        word('sjuk', { needsReview: true, reason: '请核对词形' }),
        word('Jag är sjuk.'),
        word('läkare', { meaning: '' }),
      ]),
    );
    expect(result.drafts.map((w) => w.term)).toEqual(['en tid', 'sjuk']);
    expect(result.drafts[1]).toMatchObject({ selected: false, issue: '请核对词形' });
    await expect(
      generateVocabulary(request, config, upstream([word('Jag är sjuk.')])),
    ).rejects.toThrow('未生成有效词条');
  });
  it.each(['responses', 'chat'] as const)(
    '使用 %s 真实请求格式传递课程和主题，并限制输出数量',
    async (style) => {
      const fetcher = upstream(Array.from({ length: 8 }, (_, i) => word(`ord${i}`)));
      const result = await generateVocabulary(request, { ...config, style }, fetcher);
      expect(result.drafts).toHaveLength(5);
      const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
      const prompt = (body.input || body.messages)
        .map((m: { content: string }) => m.content)
        .join('\n');
      expect(prompt).toContain('SFI 课程 B');
      expect(prompt).toContain('看病就医');
      expect(prompt).toContain('没有用户原文');
      expect(prompt).not.toContain('只处理给定材料中的');
    },
  );
  it('生成接口可用，缺少授权或课程不合法不调用模型', async () => {
    const fetcher = upstream();
    const handler = createAiHandler(() => config, fetcher, '');
    const server = createServer((req, res) => {
      void handler(req, res, () => res.writeHead(404).end());
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ai/generate`;
    try {
      for (const patch of [{ consent: false }, { sfiLevel: 'E' }])
        expect(
          (
            await fetch(url, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ...request, ...patch }),
            })
          ).status,
        ).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).drafts[0].ai.sfiLevel).toBe('B');
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
