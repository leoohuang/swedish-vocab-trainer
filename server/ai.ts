import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { connectionSchema } from '../shared/connection.ts';
import { safeUserFetch, userBaseURL } from './safe-upstream.ts';
import { parseEnv } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { aiRequest, topicRequest } from '../shared/ai.ts';
import type { AiRequest, TopicRequest } from '../shared/ai.ts';
import { AiError, extractVocabulary, generateVocabulary } from '../shared/extraction.ts';
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
  options: { byokOnly?: boolean } = {},
) {
  const allowedOrigin = publicOrigin ? new URL(publicOrigin).origin : '';
  const byokOnly = options.byokOnly ?? !!publicOrigin;
  let active = 0;
  const calls = new Map<string, number[]>();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0];
    if (path !== '/api/ai/status' && path !== '/api/ai/extract' && path !== '/api/ai/generate') {
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
      if (path === '/api/ai/status' && req.method === 'GET') {
        const config = byokOnly
          ? {
              key: '',
              model: 'gpt-4.1-mini',
              baseURL: 'https://api.openai.com/v1',
              style: 'responses',
            }
          : getConfig();
        json(res, 200, {
          configured: !!config.key,
          byokOnly,
          supportsUserKey: true,
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
      let request: AiRequest | TopicRequest;
      try {
        const body = JSON.parse(Buffer.concat(parts).toString('utf8'));
        request = path === '/api/ai/generate' ? topicRequest.parse(body) : aiRequest.parse(body);
      } catch {
        json(res, 400, {
          error:
            path === '/api/ai/generate'
              ? '请输入 1–160 字主题，选择 SFI A–D、5–30 个词，并确认发送授权。'
              : '请确认发送授权、材料内容、水平及目标词数；每次最多 30000 字符。',
        });
        return;
      }
      const suppliedKey = req.headers['x-ord-ai-key'];
      let config: AiConfig;
      const personal = suppliedKey !== undefined;
      if (personal) {
        const parsed = connectionSchema.safeParse({
          key: suppliedKey,
          model: req.headers['x-ord-ai-model'],
          baseURL: req.headers['x-ord-ai-url'],
          style: req.headers['x-ord-ai-style'],
        });
        if (!parsed.success)
          throw new AiError(400, 'API 设置不完整，请检查密钥、模型名称、Base URL 和接口格式。');
        const url = userBaseURL(parsed.data.baseURL);
        config = { ...parsed.data, baseURL: url.href.replace(/\/$/, '') };
      } else {
        if (byokOnly)
          throw new AiError(401, '公开网站需要使用你自己的 API 密钥，请先打开 AI 设置。');
        config = getConfig();
      }
      if (active >= 2) {
        json(res, 429, { error: '已有整理任务进行中，请稍后重试。' });
        return;
      }
      const now = Date.now();
      for (const [id, times] of calls)
        if (!times.length || times[times.length - 1] < now - 60000) calls.delete(id);
      const caller = createHash('sha256').update(config.key).digest('hex');
      const recent = (calls.get(caller) || []).filter((time) => time >= now - 60000);
      if (recent.length >= 10 || (!calls.has(caller) && calls.size >= 1000)) {
        json(res, 429, { error: '整理请求过于频繁，请一分钟后再试。' });
        return;
      }
      if (!config.key)
        throw new AiError(503, '尚未配置 AI 密钥，请在项目 .env.local 设置 OPENAI_API_KEY。');
      active++;
      recent.push(now);
      calls.set(caller, recent);
      const controller = new AbortController();
      const disconnect = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on('close', disconnect);
      try {
        const result =
          'topic' in request
            ? await generateVocabulary(
                request,
                config,
                personal && fetcher === fetch ? safeUserFetch : fetcher,
                controller.signal,
              )
            : await extractVocabulary(
                request,
                config,
                personal && fetcher === fetch ? safeUserFetch : fetcher,
                controller.signal,
              );
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
