import { withWordGroups } from './groups';
import { aiEvidence } from '../shared/ai';
import { get, update } from 'idb-keyval';
import { z } from 'zod';
import { emptyData } from './model';
import type { Data } from './model';
const str = z.string().max(20000),
  id = z.string().min(1).max(100);
const draft = z.object({
  ai: aiEvidence.optional(),
  id,
  term: str,
  meaning: str,
  note: str,
  source: str,
  location: str,
  selected: z.boolean(),
  issue: str,
});
const score = z.object({
  wins: z.number().int().nonnegative(),
  tries: z.number().int().nonnegative(),
  misses: z.number().int().nonnegative(),
  hints: z.number().int().nonnegative(),
});
const schema = z.object({
  version: z.literal(1),
  audio: z
    .object({ typingSound: z.boolean(), answerSound: z.boolean(), autoPronounce: z.boolean() })
    .optional(),
  decks: z
    .array(z.object({ id, name: str, created: z.number(), pending: z.array(draft).max(2000) }))
    .max(500),
  words: z
    .array(
      z.object({
        id,
        ai: aiEvidence.optional(),
        group: z.number().int().min(1).max(100000).optional(),
        deckId: id,
        term: str.min(1),
        meaning: str.min(1),
        note: str,
        source: str,
        location: str,
        favorite: z.boolean(),
        due: z.number().nullable(),
        interval: z.number().nonnegative(),
        sessions: z.number().int().nonnegative(),
      }),
    )
    .max(50000),
  history: z.array(
    z.object({
      id,
      date: z.number(),
      words: z.number(),
      completed: z.number(),
      attempts: z.number(),
      correct: z.number(),
    }),
  ),
  session: z
    .object({
      id,
      ids: z.array(id).min(1).max(20),
      tasks: z
        .array(
          z.object({
            wordId: id,
            type: z.enum(['choice', 'spell']),
            options: z.array(str).max(4).optional(),
          }),
        )
        .min(1)
        .max(200),
      position: z.number().int().nonnegative(),
      scores: z.record(id, score),
      feedback: z.object({ correct: z.boolean(), answer: str, assisted: z.boolean() }).nullable(),
      hinted: z.boolean(),
      input: str,
      finished: z.boolean(),
      started: z.number(),
      ended: z.number().optional(),
    })
    .nullable(),
});
export function validateData(raw: unknown): Data {
  const d = schema.parse(raw);
  const deckIds = new Set(d.decks.map((x) => x.id)),
    wordIds = new Set(d.words.map((x) => x.id));
  if (
    deckIds.size !== d.decks.length ||
    wordIds.size !== d.words.length ||
    d.words.some((w) => !deckIds.has(w.deckId))
  )
    throw new Error('备份中的词库关联不完整。');
  const s = d.session;
  if (
    s &&
    (s.position > s.tasks.length ||
      (!s.finished && s.position === s.tasks.length) ||
      s.ids.some((x) => !wordIds.has(x) || !s.scores[x]) ||
      s.tasks.some((t) => !s.ids.includes(t.wordId)))
  )
    throw new Error('备份中的练习记录不完整。');
  return withWordGroups(d);
}
const KEY = 'ord-data-v1';
let baseline: string | undefined;
export class StorageConflictError extends Error {
  constructor() {
    super(
      '另一个标签页已更新词库。为避免覆盖，当前修改尚未保存；请先导出当前备份，再刷新查看已保存的词库。',
    );
  }
}
export async function loadData(): Promise<Data> {
  const value = await get(KEY);
  const data = value ? validateData(value) : emptyData();
  baseline = JSON.stringify(data);
  return data;
}
// Serialize this tab's writes and compare inside an IndexedDB transaction across tabs.
let writes = Promise.resolve();
export function saveData(data: Data): Promise<void> {
  const next = writes
    .catch(() => {})
    .then(async () => {
      const snapshot = JSON.stringify(validateData(data));
      if (snapshot === baseline) return;
      await update(KEY, (value: unknown) => {
        const current = JSON.stringify(value ? validateData(value) : emptyData());
        if (baseline === undefined || current !== baseline) throw new StorageConflictError();
        return data;
      });
      baseline = snapshot;
    });
  writes = next;
  return next;
}
export function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
