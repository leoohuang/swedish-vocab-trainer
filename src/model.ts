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
  passed?: boolean;
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
  turn?: number;
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
export const hasPassed = (word: Pick<Word, 'passed'>) => word.passed === true;
export const sessionPassed = (s: Session) =>
  s.ids.length > 0 && s.ids.every((id) => (s.scores[id]?.wins ?? 0) >= 2);
export function resumeIncompleteSession(s: Session): Session {
  if (!s.finished || sessionPassed(s)) return s;
  const wordId = s.ids.find((id) => (s.scores[id]?.wins ?? 0) < 2)!;
  const past = s.tasks.slice(0, s.position).slice(-100);
  const { ended: _ended, ...rest } = s;
  return {
    ...rest,
    tasks: [...past, { wordId, type: 'spell' }],
    position: past.length,
    turn: s.turn ?? s.position,
    finished: false,
    feedback: null,
    hinted: false,
    input: '',
  };
}
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
  return {
    id: uid(),
    ids: words.map((w) => w.id),
    tasks,
    position: 0,
    turn: 0,
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
  if (!task || task.wordId !== word.id) return s;
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
  if (s.finished || !s.feedback) return s;
  // Keep unanswered warm-up questions when continuing an older saved session.
  const choices = s.tasks
    .slice(s.position + 1)
    .filter((t) => t.type === 'choice' && s.scores[t.wordId].wins < 2);
  const past = s.tasks.slice(0, s.position + 1);
  const remaining = s.ids.filter((id) => s.scores[id].wins < 2);
  let next: Task | undefined = choices[0];
  if (!next && remaining.length) {
    // Age / spacing is a deterministic weighted queue. Zero-win words return
    // about twice as often as one-win words, while ageing prevents starvation.
    const lastSeen = new Map<string, number>();
    past.forEach((t, index) => {
      if (t.type === 'spell') lastSeen.set(t.wordId, index);
    });
    const priority = (id: string) =>
      (past.length - (lastSeen.get(id) ?? -1)) / (s.scores[id].wins + 1);
    const id = [...remaining].sort(
      (a, b) => priority(b) - priority(a) || s.scores[a].wins - s.scores[b].wins,
    )[0];
    next = { wordId: id, type: 'spell' };
  }
  // Retries are unlimited. Bound only the scheduling trace so long sessions
  // remain small and continue to pass the existing backup validation limit.
  const tasks = [...past.slice(-100), ...(next?.type === 'choice' ? choices : next ? [next] : [])];
  const finished = !next;
  const position = finished ? tasks.length : Math.min(past.length, 100);
  return {
    ...s,
    tasks,
    position,
    turn: (s.turn ?? s.position) + 1,
    feedback: null,
    input: '',
    hinted: false,
    finished,
    ...(finished ? { ended: Date.now() } : {}),
  };
}
export function finishSession(data: Data, s: Session): Data {
  if (!s.finished) return { ...data, session: s };
  if (!sessionPassed(s)) return { ...data, session: resumeIncompleteSession(s) };
  const recorded = data.history.find((h) => h.id === s.id);
  if (recorded && recorded.completed === recorded.words) return { ...data, session: s };
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
      return {
        ...w,
        passed: true,
        sessions: w.sessions + (recorded ? 0 : 1),
        interval,
        due: now + interval * 86400000,
      };
    }),
    history: [
      ...data.history.filter((h) => h.id !== s.id),
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
