import { useSyncExternalStore } from 'react';
import english from './translations.en.json';
export type Language = 'zh' | 'en';
const key = 'ord-language';
function initialLanguage(): Language {
  try {
    return localStorage.getItem(key) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}
let language = initialLanguage();
const listeners = new Set<() => void>();
const messages: Record<string, string> = english;
const reverse = new Map(Object.entries(messages).map(([zh, en]) => [en, zh]));
export const getLanguage = () => language;
export function setLanguage(next: Language) {
  if (next !== 'zh' && next !== 'en') return;
  language = next;
  try {
    localStorage.setItem(key, next);
  } catch {
    /* Keep the in-memory preference. */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    document.title = next === 'en' ? 'ord. · Swedish vocabulary practice' : 'ord. · 瑞典语单词练习';
  }
  listeners.forEach((notify) => notify());
}
export function useLanguage() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    getLanguage,
    () => 'zh' as Language,
  );
}
/** Translate interface messages only. Never pass a user's term, meaning, or source text here. */
export function t(source: string, ...values: unknown[]): string {
  const normalized = source.replace(/\s+/g, ' ').trim();
  const template =
    language === 'en' ? (messages[normalized] ?? source) : (reverse.get(source) ?? source);
  const spaced =
    (/^\s/.test(source) && !/^\s/.test(template) ? ' ' : '') +
    template +
    (/\s$/.test(source) && !/\s$/.test(template) ? ' ' : '');
  return spaced.replace(/\{(\d+)\}/g, (match, index: string) =>
    index in values ? String(values[Number(index)]) : match,
  );
}
if (typeof document !== 'undefined') {
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  document.title =
    language === 'en' ? 'ord. · Swedish vocabulary practice' : 'ord. · 瑞典语单词练习';
}
