import type { Data } from './model';
import { uid } from './model';
import { validateData } from './storage';

// Existing decks remain authoritative. Importing the same backup twice is harmless.
export function mergeBackup(current: Data, incoming: Data): Data {
  const deckIds = new Set(current.decks.map((d) => d.id));
  const added = incoming.decks.filter((d) => !deckIds.has(d.id));
  const addedIds = new Set(added.map((d) => d.id));
  const wordIds = new Set(current.words.map((w) => w.id));
  const remap = new Map<string, string>();
  const words = incoming.words
    .filter((w) => addedIds.has(w.deckId))
    .map((w) => {
      const id = wordIds.has(w.id) ? uid() : w.id;
      wordIds.add(id);
      remap.set(w.id, id);
      return { ...w, id };
    });
  const s = incoming.session;
  const importedSession =
    s && s.ids.every((id) => remap.has(id))
      ? {
          ...s,
          ids: s.ids.map((id) => remap.get(id)!),
          tasks: s.tasks.map((t) => ({ ...t, wordId: remap.get(t.wordId)! })),
          scores: Object.fromEntries(
            Object.entries(s.scores)
              .filter(([id]) => remap.has(id))
              .map(([id, score]) => [remap.get(id)!, score]),
          ),
        }
      : null;
  const historyIds = new Set(current.history.map((h) => h.id));
  return validateData({
    ...current,
    decks: [...current.decks, ...added],
    words: [...current.words, ...words],
    history: [...current.history, ...incoming.history.filter((h) => !historyIds.has(h.id))],
    session:
      current.session && !current.session.finished
        ? current.session
        : importedSession || current.session,
  });
}
