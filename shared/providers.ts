import type { UserConnection } from './connection';
export type ProviderId = 'openai' | 'anthropic' | 'custom';
export const providers: {
  id: ProviderId;
  name: string;
  baseURL: string;
  model: string;
  style: UserConnection['style'];
}[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    style: 'responses',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-5-5',
    style: 'anthropic',
  },
  { id: 'custom', name: '自定义接口', baseURL: '', model: '', style: 'chat' },
];
export function providerFor(connection: UserConnection): ProviderId {
  return (
    providers.find((p) => p.id !== 'custom' && p.baseURL === connection.baseURL)?.id || 'custom'
  );
}
