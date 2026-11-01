import { useSyncExternalStore } from 'react';
import { connectionSchema, defaultConnection } from '../shared/connection';
import type { UserConnection } from '../shared/connection';
const preferenceKey = 'ord-ai-preferences';
function initial(): UserConnection {
  try {
    const preferences = JSON.parse(localStorage.getItem(preferenceKey) || '{}');
    const result = connectionSchema.safeParse({
      ...preferences,
      key: 'preference-validation-only',
    });
    if (result.success) return { ...result.data, key: '' };
  } catch {
    /* Use defaults when storage is unavailable. */
  }
  return defaultConnection();
}
let connection = initial();
const listeners = new Set<() => void>();
export const getAiConnection = () => connection;
export function setAiConnection(next: UserConnection) {
  const validated = connectionSchema.parse(next);
  const url = new URL(validated.baseURL);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== '443')
  )
    throw new Error('请填写不含账号或参数的 HTTPS Base URL（443 端口）。');
  connection = { ...validated, baseURL: url.href.replace(/\/$/, '') };
  const { key: _key, ...preferences } = connection;
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
  } catch {
    /* Optional non-secret preferences. */
  }
  listeners.forEach((notify) => notify());
}
export function clearAiKey() {
  connection = { ...connection, key: '' };
  listeners.forEach((notify) => notify());
}
export function useAiConnection() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    getAiConnection,
    defaultConnection,
  );
}
export function personalAiHeaders(): Record<string, string> {
  const value = getAiConnection();
  return value.key
    ? {
        'X-Ord-AI-Key': value.key,
        'X-Ord-AI-Model': value.model,
        'X-Ord-AI-URL': value.baseURL,
        'X-Ord-AI-Style': value.style,
      }
    : {};
}
