import { useSyncExternalStore } from 'react';
import { connectionSchema, defaultConnection } from '../shared/connection';
import type { UserConnection } from '../shared/connection';
const preferenceKey = 'ord-ai-preferences';
const credentialKey = 'ord-ai-key';
export const remembersAiKey = () => {
  try {
    return !!localStorage.getItem(credentialKey);
  } catch {
    return false;
  }
};
function initial(): UserConnection {
  try {
    const preferences = JSON.parse(localStorage.getItem(preferenceKey) || '{}');
    const result = connectionSchema.safeParse({
      ...preferences,
      key: 'preference-validation-only',
    });
    const saved = connectionSchema.safeParse(
      JSON.parse(localStorage.getItem(credentialKey) || 'null'),
    );
    if (saved.success) return saved.data;
    if (result.success) return { ...result.data, key: '' };
  } catch {
    /* Use defaults when storage is unavailable. */
  }
  return defaultConnection();
}
let connection = initial();
const listeners = new Set<() => void>();
export const getAiConnection = () => connection;
export function setAiConnection(next: UserConnection, remember = false) {
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
  const nextConnection = { ...validated, baseURL: url.href.replace(/\/$/, '') };
  const { key: _key, ...preferences } = nextConnection;
  try {
    if (remember) localStorage.setItem(credentialKey, JSON.stringify(nextConnection));
    else localStorage.removeItem(credentialKey);
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
  } catch {
    if (remember) throw new Error('无法在此浏览器保存密钥，请关闭记住选项后重试。');
  }
  connection = nextConnection;
  listeners.forEach((notify) => notify());
}
export function clearAiKey() {
  try {
    localStorage.removeItem(credentialKey);
  } catch {
    /* Memory-only browsers. */
  }
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
