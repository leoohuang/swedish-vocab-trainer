import { z } from 'zod';
export const materialMode = z.enum(['auto', 'vocabulary', 'article', 'mixed']);
export type MaterialMode = z.infer<typeof materialMode>;
export const sourceBlock = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(5000),
  location: z.string().max(300),
});
export type SourceBlock = z.infer<typeof sourceBlock>;
export const aiRequest = z
  .object({
    blocks: z.array(sourceBlock).min(1).max(1000),
    mode: materialMode,
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    count: z.number().int().min(5).max(30),
    knownTerms: z.array(z.string().max(150)).max(2000).default([]),
    consent: z.literal(true),
  })
  .superRefine((v, c) => {
    if (v.blocks.reduce((a, b) => a + b.text.length, 0) > 30000)
      c.addIssue({ code: 'custom', message: '每次 AI 整理最多 30000 字符，请分段导入。' });
    if (new Set(v.blocks.map((b) => b.id)).size !== v.blocks.length)
      c.addIssue({ code: 'custom', message: '来源编号重复，请重新读取材料。' });
  });
export type AiRequest = z.infer<typeof aiRequest>;
export const topicRequest = z.object({
  topic: z.string().trim().min(1).max(160),
  sfiLevel: z.enum(['A', 'B', 'C', 'D']),
  count: z.number().int().min(5).max(30),
  consent: z.literal(true),
});
export type TopicRequest = z.infer<typeof topicRequest>;
export const aiEvidence = z.object({
  reason: z.string().max(1000),
  example: z.string().max(2000),
  exampleTranslation: z.string().max(2000),
  meaningOrigin: z.enum(['source', 'ai', 'edited']),
  mode: z.enum(['vocabulary', 'article', 'mixed', 'generated']),
  topic: z.string().max(160).optional(),
  sfiLevel: z.enum(['A', 'B', 'C', 'D']).optional(),
});
export type AiEvidence = z.infer<typeof aiEvidence>;
// This deliberately uses only the JSON Schema subset supported by strict structured outputs.
export const modelResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detectedMode: { type: 'string', enum: ['vocabulary', 'article', 'mixed'] },
    words: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          term: { type: 'string' },
          meaning: { type: 'string' },
          note: { type: 'string' },
          example: { type: 'string' },
          exampleTranslation: { type: 'string' },
          reason: { type: 'string' },
          blockId: { type: 'string' },
          quote: { type: 'string' },
          meaningOrigin: { type: 'string', enum: ['source', 'ai'] },
          needsReview: { type: 'boolean' },
          priority: { type: 'integer', enum: [1, 2, 3, 4, 5] },
        },
        required: [
          'term',
          'meaning',
          'note',
          'example',
          'exampleTranslation',
          'reason',
          'blockId',
          'quote',
          'meaningOrigin',
          'needsReview',
          'priority',
        ],
      },
    },
    unresolved: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          blockId: { type: 'string' },
          quote: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['blockId', 'quote', 'reason'],
      },
    },
  },
  required: ['detectedMode', 'words', 'unresolved'],
} as const;
export const modelResult = z.object({
  detectedMode: z.enum(['vocabulary', 'article', 'mixed']),
  words: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(150),
        meaning: z.string().max(1500),
        note: z.string().max(2000),
        example: z.string().max(2000),
        exampleTranslation: z.string().max(2000),
        reason: z.string().max(1000),
        blockId: z.string(),
        quote: z.string().max(5000),
        meaningOrigin: z.enum(['source', 'ai']),
        needsReview: z.boolean(),
        priority: z.number().int().min(1).max(5),
      }),
    )
    .max(200),
  unresolved: z
    .array(
      z.object({ blockId: z.string(), quote: z.string().max(5000), reason: z.string().max(1000) }),
    )
    .max(200),
});
export type ModelResult = z.infer<typeof modelResult>;
