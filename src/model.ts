import type { AudioSettings } from './audio';
import type { AiEvidence } from '../shared/ai';
export type Draft = {
  ai?: AiEvidence;
  id: string;
  term: string;
  meaning: string;
  note: string;
  source: string;
  location: string;
  selected: boolean;
  issue: string;
};
export type Word = {
  group?: number;
  ai?: AiEvidence;
  id: string;
  deckId: string;
  term: string;
  meaning: string;
  note: string;
  source: string;
  location: string;
  favorite: boolean;
  due: number | null;
  interval: number;
  sessions: number;
};
export type Deck = { id: string; name: string; created: number; pending: Draft[] };
export type Task = { wordId: string; type: 'choice' | 'spell'; options?: string[] };
export type WordScore = { wins: number; tries: number; misses: number; hints: number };
export type Feedback = { correct: boolean; answer: string; assisted: boolean };
export type Session = {
  id: string;
  ids: string[];
  tasks: Task[];
  position: number;
  scores: Record<string, WordScore>;
  feedback: Feedback | null;
  hinted: boolean;
  input: string;
  finished: boolean;
  started: number;
  ended?: number;
};
export type History = {
  id: string;
  date: number;
  words: number;
  completed: number;
  attempts: number;
  correct: number;
};
export type Data = {
  audio?: AudioSettings;
  version: 1;
  decks: Deck[];
  words: Word[];
  session: Session | null;
  history: History[];
};
export const emptyData = (): Data => ({
  version: 1,
  decks: [],
  words: [],
  session: null,
  history: [],
});
export const uid = () => crypto.randomUUID();
export const normalize = (text: string) =>
  text.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv');
export const wordKey = (word: Pick<Word, 'term' | 'meaning'>) =>
  `${normalize(word.term)}\u0000${normalize(word.meaning)}`;
export const spellingAnswer = (word: Pick<Word, 'term'>) =>
  word.term.replace(/^(en|ett)\s+/i, '').trim();
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createSession(words: Word[], pool: Word[]): Session {
  const tasks: Task[] = shuffle(words).map((w) => {
    const distractors = shuffle([
      ...new Set(
        pool
          .filter(
            (p) =>
              p.id !== w.id &&
              normalize(p.term) !== normalize(w.term) &&
              !normalize(p.meaning).includes(normalize(w.meaning)) &&
              !normalize(w.meaning).includes(normalize(p.meaning)),
          )
          .map((p) => p.meaning),
      ),
    ]).slice(0, 3);
    return {
      wordId: w.id,
      type: 'choice',
      options: distractors.length ? shuffle([w.meaning, ...distractors]) : [],
    };
  });
  tasks.push(
    ...shuffle(words).map((w) => ({ wordId: w.id, type: 'spell' as const })),
    ...shuffle(words).map((w) => ({ wordId: w.id, type: 'spell' as const })),
  );
  return {
    id: uid(),
    ids: words.map((w) => w.id),
    tasks,
    position: 0,
    scores: Object.fromEntries(
      words.map((w) => [w.id, { wins: 0, tries: 0, misses: 0, hints: 0 }]),
    ),
    feedback: null,
    hinted: false,
    input: '',
    finished: false,
    started: Date.now(),
  };
}
export function answerSession(s: Session, word: Word, answer: string): Session {
  if (s.finished || s.feedback) return s;
  const task = s.tasks[s.position];
  const correct =
    normalize(answer) === normalize(task.type === 'spell' ? spellingAnswer(word) : word.meaning);
  const score = { ...s.scores[word.id] };
  if (task.type === 'spell') {
    score.tries++;
    if (correct && !s.hinted) score.wins++;
    if (s.hinted) score.hints++;
  }
  if (!correct) score.misses++;
  return {
    ...s,
    scores: { ...s.scores, [word.id]: score },
    feedback: { correct, answer, assisted: s.hinted },
  };
}
export function advanceSession(s: Session): Session {
  const task = s.tasks[s.position];
  let tasks = [...s.tasks];
  if (task.type === 'spell') {
    const score = s.scores[task.wordId];
    const future = tasks
      .slice(s.position + 1)
      .filter((t) => t.wordId === task.wordId && t.type === 'spell').length;
    if (score.wins + future < 2 && score.tries + future < 4)
      tasks.push({ wordId: task.wordId, type: 'spell' });
  }
  const position = s.position + 1;
  return {
    ...s,
    tasks,
    position,
    feedback: null,
    input: '',
    hinted: false,
    finished: position >= tasks.length,
    ...(position >= tasks.length ? { ended: Date.now() } : {}),
  };
}
export function finishSession(data: Data, s: Session): Data {
  if (!s.finished || data.history.some((h) => h.id === s.id)) return { ...data, session: s };
  const now = s.ended || Date.now();
  return {
    ...data,
    session: s,
    words: data.words.map((w) => {
      const score = s.scores[w.id];
      if (!score) return w;
      const strong = score.wins >= 2 && !score.misses && !score.hints;
      const interval = strong
        ? w.interval === 0
          ? 1
          : w.interval === 1
            ? 3
            : w.interval === 3
              ? 7
              : Math.min(w.interval * 2, 60)
        : 1;
      return { ...w, sessions: w.sessions + 1, interval, due: now + interval * 86400000 };
    }),
    history: [
      ...data.history,
      {
        id: s.id,
        date: now,
        words: s.ids.length,
        completed: Object.values(s.scores).filter((x) => x.wins >= 2).length,
        attempts: Object.values(s.scores).reduce((a, x) => a + x.tries, 0),
        correct: Object.values(s.scores).reduce((a, x) => a + x.wins, 0),
      },
    ],
  };
}
