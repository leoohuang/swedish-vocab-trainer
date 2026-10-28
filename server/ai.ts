import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { aiRequest } from '../shared/ai.ts';
import type { AiRequest } from '../shared/ai.ts';
import { AiError, extractVocabulary } from '../shared/extraction.ts';
import type { AiConfig } from '../shared/extraction.ts';
export {
  AiError,
  callModel,
  chunksFor,
  extractVocabulary,
  groundResults,
  promptFor,
} from '../shared/extraction.ts';
export type { AiConfig } from '../shared/extraction.ts';
export function publicSiteOrigin(env: Record<string, string | undefined> = process.env): string {
  return env.PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL || '';
}
export function loadAiConfig(): AiConfig {
  let local: Record<string, string | undefined> = {};
  for (const filename of ['.env', '.env.local'])
    try {
      local = { ...local, ...parseEnv(readFileSync(filename, 'utf8')) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new AiError(500, '无法读取服务端 AI 配置，请检查环境文件。');
    }
  const env = { ...local, ...process.env };
  return {
    key: env.OPENAI_API_KEY?.trim() || '',
    model: env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    baseURL: (env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
    style: env.AI_API_STYLE === 'chat' ? 'chat' : 'responses',
  };
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}
export function createAiHandler(
  getConfig = loadAiConfig,
  fetcher: typeof fetch = fetch,
  publicOrigin = publicSiteOrigin(),
) {
  const allowedOrigin = publicOrigin ? new URL(publicOrigin).origin : '';
  let active = 0;
  const calls: number[] = [];
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0];
    if (path !== '/api/ai/status' && path !== '/api/ai/extract') {
      next();
      return;
    }
    const host = req.headers.host || '';
    const origin = req.headers.origin;
    try {
      const validHost = allowedOrigin
        ? new URL(allowedOrigin).host === host
        : ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(`http://${host}`).hostname);
      if (!validHost) {
        json(res, 403, { error: '请求主机不在当前网站的允许范围内。' });
        return;
      }
    } catch {
      json(res, 403, { error: '请求主机无效。' });
      return;
    }
    if (origin) {
      try {
        if (
          allowedOrigin ? new URL(origin).origin !== allowedOrigin : new URL(origin).host !== host
        ) {
          json(res, 403, { error: '只允许从当前页面调用 AI 接口。' });
          return;
        }
      } catch {
        json(res, 403, { error: '请求来源无效。' });
        return;
      }
    }
    if (allowedOrigin && req.method === 'POST' && !origin) {
      json(res, 403, { error: '请从当前网站发起整理请求。' });
      return;
    }
    try {
      const config = getConfig();
      if (path === '/api/ai/status' && req.method === 'GET') {
        json(res, 200, {
          configured: !!config.key,
          model: config.model,
          provider: new URL(config.baseURL).hostname,
          style: config.style,
        });
        return;
      }
      if (req.method !== 'POST') {
        json(res, 405, { error: '请使用 POST 请求。' });
        return;
      }
      if (!req.headers['content-type']?.includes('application/json')) {
        json(res, 415, { error: '请求需要 JSON 内容。' });
        return;
      }
      let size = 0;
      const parts: Buffer[] = [];
      for await (const part of req) {
        size += part.length;
        if (size > 256000) {
          json(res, 413, { error: '材料过大，请缩短后重试。' });
          return;
        }
        parts.push(Buffer.from(part));
      }
      let request: AiRequest;
      try {
        request = aiRequest.parse(JSON.parse(Buffer.concat(parts).toString('utf8')));
      } catch {
        json(res, 400, {
          error: '请确认发送授权、材料内容、水平及目标词数；每次最多 30000 字符。',
        });
        return;
      }
      if (active >= 2) {
        json(res, 429, { error: '已有整理任务进行中，请稍后重试。' });
        return;
      }
      const now = Date.now();
      while (calls.length && calls[0] < now - 60000) calls.shift();
      if (calls.length >= 10) {
        json(res, 429, { error: '整理请求过于频繁，请一分钟后再试。' });
        return;
      }
      if (!config.key)
        throw new AiError(503, '尚未配置 AI 密钥，请在项目 .env.local 设置 OPENAI_API_KEY。');
      active++;
      calls.push(now);
      const controller = new AbortController();
      const disconnect = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on('close', disconnect);
      try {
        const result = await extractVocabulary(request, config, fetcher, controller.signal);
        if (!res.destroyed) json(res, 200, result);
      } finally {
        active--;
        res.off('close', disconnect);
      }
    } catch (error) {
      if (!res.destroyed)
        json(res, error instanceof AiError ? error.status : 500, {
          error: error instanceof AiError ? error.message : 'AI 整理失败，请检查服务端配置后重试。',
        });
    }
  };
}
