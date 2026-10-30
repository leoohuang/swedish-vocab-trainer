import type { Data, Deck, Word } from './model';
import { hasPassed } from './model';
export const GROUP_SIZE = 10;
export type StudyGroup = {
  key: string;
  deckId: string;
  deckName: string;
  number: number;
  words: Word[];
  remaining: Word[];
  completed: boolean;
  dueCount: number;
};
/** Assign once. Removing or appending words must never renumber existing groups. */
export function assignWordGroups(words: Word[]): Word[] {
  const slots = new Map<string, { number: number; count: number; locked: boolean }>();
  for (const w of words) {
    if (w.group === undefined) continue;
    const last = slots.get(w.deckId);
    if (!last || w.group > last.number)
      slots.set(w.deckId, { number: w.group, count: 1, locked: w.sessions > 0 });
    else if (w.group === last.number) {
      last.count++;
      last.locked ||= w.sessions > 0;
    }
  }
  for (const slot of slots.values())
    if (slot.count >= GROUP_SIZE || slot.locked) {
      slot.number++;
      slot.count = 0;
      slot.locked = false;
    }
  return words.map((w) => {
    if (w.group !== undefined) return w;
    let slot = slots.get(w.deckId);
    if (!slot) {
      slot = { number: 1, count: 0, locked: false };
      slots.set(w.deckId, slot);
    }
    if (slot.count >= GROUP_SIZE) {
      slot.number++;
      slot.count = 0;
    }
    slot.count++;
    return { ...w, group: slot.number };
  });
}
export function withWordGroups(data: Data): Data {
  return data.words.some((w) => w.group === undefined)
    ? { ...data, words: assignWordGroups(data.words) }
    : data;
}
export function studyGroups(words: Word[], decks: Deck[], now = Date.now()): StudyGroup[] {
  const result = new Map<string, StudyGroup>();
  const names = new Map(decks.map((d) => [d.id, d.name]));
  for (const word of assignWordGroups(words)) {
    const key = `${word.deckId}:${word.group}`;
    let group = result.get(key);
    if (!group) {
      group = {
        key,
        deckId: word.deckId,
        deckName: names.get(word.deckId) || '我的词库',
        number: word.group!,
        words: [],
        remaining: [],
        completed: false,
        dueCount: 0,
      };
      result.set(key, group);
    }
    group.words.push(word);
    if (!hasPassed(word)) group.remaining.push(word);
    if (word.due !== null && word.due <= now) group.dueCount++;
  }
  const order = new Map(
    [...new Set([...result.values()].map((g) => g.deckId))].map((id, index) => [id, index]),
  );
  return [...result.values()]
    .map((g) => ({ ...g, completed: !g.remaining.length }))
    .sort((a, b) =>
      a.deckId === b.deckId ? a.number - b.number : order.get(a.deckId)! - order.get(b.deckId)!,
    );
}
export function recommendedGroup(groups: StudyGroup[], reviewOnly = false): StudyGroup | undefined {
  return reviewOnly
    ? groups.find((g) => g.dueCount > 0)
    : groups.find((g) => !g.completed) || groups.find((g) => g.dueCount > 0);
}
export function groupWords(group: StudyGroup, reviewOnly = false): Word[] {
  if (reviewOnly) return group.words.filter((w) => w.due !== null && w.due <= Date.now());
  return group.completed ? group.words : group.remaining;
}
