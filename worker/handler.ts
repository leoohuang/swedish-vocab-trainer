import { aiRequest } from '../shared/ai';
import { AiError, extractVocabulary } from '../shared/extraction';
import type { AiConfig } from '../shared/extraction';
type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  AI_API_STYLE?: string;
};
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
export function hostedConfig(env: Env): AiConfig {
  return {
    key: env.OPENAI_API_KEY?.trim() || '',
    model: env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    baseURL: (env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
    style: env.AI_API_STYLE === 'chat' ? 'chat' : 'responses',
  };
}
export function createWorkerHandler(
  assets: Record<string, { body: string; type: string }>,
  fetcher: typeof fetch = fetch,
) {
  let active = 0;
  const calls: number[] = [];
  return async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url),
      path = url.pathname;
    if (path.startsWith('/api/')) {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin)
        return json({ error: '只允许从当前网站调用 AI 接口。' }, 403);
      try {
        const config = hostedConfig(env);
        if (path === '/api/ai/status' && request.method === 'GET')
          return json({
            configured: !!config.key,
            model: config.model,
            provider: new URL(config.baseURL).hostname,
            style: config.style,
            hosted: true,
          });
        if (path !== '/api/ai/extract') return json({ error: '接口未找到。' }, 404);
        if (request.method !== 'POST') return json({ error: '请使用 POST 请求。' }, 405);
        if (!request.headers.get('content-type')?.includes('application/json'))
          return json({ error: '请求需要 JSON 内容。' }, 415);
        if (Number(request.headers.get('content-length') || 0) > 256000)
          return json({ error: '材料过大，请缩短后重试。' }, 413);
        const reader = request.body?.getReader();
        if (!reader) return json({ error: '请提供学习材料。' }, 400);
        const parts: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 256000) {
              await reader.cancel();
              return json({ error: '材料过大，请缩短后重试。' }, 413);
            }
            parts.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of parts) {
          bytes.set(part, offset);
          offset += part.byteLength;
        }
        const parsed = aiRequest.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
        if (!parsed.success)
          return json(
            { error: '请确认发送授权、材料内容、水平和词数；单次最多 30000 字符。' },
            400,
          );
        if (!config.key) return json({ error: '线上 AI 服务尚未配置，请联系网站维护者。' }, 503);
        const now = Date.now();
        while (calls.length && calls[0] < now - 60000) calls.shift();
        if (active >= 2 || calls.length >= 10)
          return json({ error: '整理任务较多，请稍后重试。' }, 429);
        active++;
        calls.push(now);
        try {
          return json(await extractVocabulary(parsed.data, config, fetcher, request.signal));
        } finally {
          active--;
        }
      } catch (error) {
        return json(
          {
            error:
              error instanceof AiError
                ? error.message
                : error instanceof SyntaxError
                  ? '材料请求不是有效 JSON。'
                  : 'AI 整理暂时失败，请稍后重试。',
          },
          error instanceof AiError ? error.status : error instanceof SyntaxError ? 400 : 500,
        );
      }
    }
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', { status: 405 });
    const asset = assets[path === '/' ? '/index.html' : path];
    if (!asset)
      return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    return new Response(request.method === 'HEAD' ? null : asset.body, {
      headers: {
        'Content-Type': asset.type,
        'Cache-Control': path.startsWith('/assets/')
          ? 'private, max-age=31536000, immutable'
          : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  };
}
