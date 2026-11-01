import { z } from 'zod';
import { getAiConnection, personalAiHeaders } from './ai-connection';
import type { Draft } from './model';
import { aiEvidence, materialMode } from '../shared/ai';
import type { AiRequest, TopicRequest } from '../shared/ai';
export type AiStatus = {
  configured: boolean;
  model: string;
  provider: string;
  style: string;
  byokOnly?: boolean;
  supportsUserKey?: boolean;
  personal?: boolean;
};
export type ImportOptions = {
  engine: 'ai' | 'local';
  mode: 'auto' | 'vocabulary' | 'article' | 'mixed';
  level: 'beginner' | 'intermediate' | 'advanced';
  count: number;
  skipKnown: boolean;
  consent: boolean;
};
export const defaultOptions = (): ImportOptions => ({
  engine: 'ai',
  mode: 'auto',
  level: 'beginner',
  count: 10,
  skipKnown: false,
  consent: false,
});
export async function aiStatus(): Promise<AiStatus> {
  const res = await fetch('/api/ai/status');
  if (!res.ok) throw new Error('AI 服务未启动，请通过 npm run dev 或 npm start 运行完整应用。');
  const status: AiStatus = await res.json();
  const personal = getAiConnection();
  return personal.key
    ? {
        ...status,
        configured: true,
        personal: true,
        model: personal.model,
        provider: new URL(personal.baseURL).hostname,
        style: personal.style,
      }
    : status;
}
const resultSchema = z.object({
  drafts: z
    .array(
      z.object({
        id: z.string(),
        term: z.string(),
        meaning: z.string(),
        note: z.string(),
        source: z.string(),
        location: z.string(),
        selected: z.boolean(),
        issue: z.string(),
        ai: aiEvidence.optional(),
      }),
    )
    .max(700),
  detectedMode: materialMode,
  chunks: z.number(),
  skippedKnown: z.number(),
  summary: z.string(),
});
export async function requestAi(
  request: AiRequest | TopicRequest,
  signal: AbortSignal,
): Promise<{ drafts: Draft[]; summary: string; detectedMode: string; skippedKnown: number }> {
  const res = await fetch('topic' in request ? '/api/ai/generate' : '/api/ai/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...personalAiHeaders() },
    body: JSON.stringify(request),
    signal,
  });
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new Error('AI 服务返回异常，请确认服务端已启动。');
  }
  if (!res.ok)
    throw new Error(
      typeof raw === 'object' && raw && 'error' in raw && typeof raw.error === 'string'
        ? raw.error
        : 'AI 整理没有成功，请重试。',
    );
  const result = resultSchema.safeParse(raw);
  if (!result.success) throw new Error('AI 返回内容未通过校验，原文仍保留。');
  return result.data;
}
