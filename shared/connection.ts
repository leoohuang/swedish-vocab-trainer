import { z } from 'zod';
export const connectionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .regex(/^[\x21-\x7e]+$/),
  model: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9._:/@+-]+$/),
  baseURL: z.string().trim().url().max(2000),
  style: z.enum(['responses', 'chat']),
});
export type UserConnection = z.infer<typeof connectionSchema>;
export const defaultConnection = (): UserConnection => ({
  key: '',
  model: 'gpt-4.1-mini',
  baseURL: 'https://api.openai.com/v1',
  style: 'responses',
});
