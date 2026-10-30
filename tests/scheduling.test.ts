import { expect, it } from 'vitest';
import {
  advanceSession,
  answerSession,
  createSession,
  emptyData,
  spellingAnswer,
} from '../src/model';
import type { Session, Word } from '../src/model';
import { validateData } from '../src/storage';
const words: Word[] = Array.from({ length: 3 }, (_, i) => ({
  id: `w${i}`,
  deckId: 'd',
  term: `ord${i}`,
  meaning: `释义${i}`,
  note: '',
  source: '',
  location: '',
  favorite: false,
  due: null,
  interval: 0,
  sessions: 0,
}));
function answer(s: Session, correct = false, hinted = false) {
  const word = words.find((w) => w.id === s.tasks[s.position].wordId)!;
  const value =
    s.tasks[s.position].type === 'choice' ? word.meaning : correct ? spellingAnswer(word) : 'wrong';
  return advanceSession(answerSession({ ...s, hinted }, word, value));
}
function spelling() {
  let s = createSession(words, words);
  while (s.tasks[s.position].type === 'choice') s = answer(s);
  return s;
}
function roundTrip(s: Session) {
  return validateData(
    JSON.parse(
      JSON.stringify({
        ...emptyData(),
        decks: [{ id: 'd', name: '测试', created: 1, pending: [] }],
        words,
        session: s,
      }),
    ),
  ).session!;
}
it('一直拼错也不会因次数用尽而结束，长轮次仍可保存和恢复', () => {
  let s = spelling();
  for (let i = 0; i < 600; i++) {
    s = roundTrip(answer(s));
    expect(s.finished).toBe(false);
    expect(s.tasks.length).toBeLessThanOrEqual(101);
  }
  expect(s.turn).toBe(603);
  expect(Object.values(s.scores).every((score) => score.tries >= 190)).toBe(true);
});
it('零次拼对的词约为一次拼对的词的两倍频率，较熟悉的词也不会被饿死', () => {
  let s = spelling();
  s.scores.w1.wins = 1;
  s.scores.w2.wins = 1;
  for (let i = 0; i < 120; i++) s = answer(s);
  expect(s.scores.w0.tries).toBeGreaterThan(s.scores.w1.tries * 1.5);
  expect(s.scores.w1.tries).toBeGreaterThan(20);
  expect(s.scores.w2.tries).toBeGreaterThan(20);
});
it('每个词累计独立拼对两次才结束，过关词不再出现，错误不清零已有正确次数', () => {
  let s = spelling();
  s = answer(s); // An incorrect spelling first.
  const passed = new Set<string>();
  for (let i = 0; !s.finished && i < 30; i++) {
    const id = s.tasks[s.position].wordId;
    expect(passed.has(id)).toBe(false);
    s = answer(s, true);
    if (s.scores[id].wins >= 2) passed.add(id);
    if (passed.size < words.length) expect(s.finished).toBe(false);
  }
  expect(s.finished).toBe(true);
  expect(passed.size).toBe(3);
  expect(Object.values(s.scores).map((score) => score.wins)).toEqual([2, 2, 2]);
  expect(Object.values(s.scores).reduce((n, score) => n + score.tries, 0)).toBe(7);
});
it('正确、错误和提示的混合练习可跨刷新继续，提示不计独立正确', () => {
  let s = spelling();
  const first = s.tasks[s.position].wordId;
  s = answer(s, true);
  for (let i = 0; i < 40; i++) s = answer(s, true, true);
  s = roundTrip(s);
  expect(s.scores[first].wins).toBe(1);
  expect(s.finished).toBe(false);
  while (!s.finished) s = roundTrip(answer(s, true));
  expect(Object.values(s.scores).every((score) => score.wins === 2)).toBe(true);
});
it('旧版未完成的四次失败记录继续练习，丢弃未来已过关词的旧排题', () => {
  let s = spelling();
  const current = s.tasks[s.position].wordId;
  const passed = words.find((w) => w.id !== current)!.id;
  delete s.turn;
  s.scores[current].tries = 4;
  s.scores[passed].wins = 2;
  s.tasks.push({ wordId: passed, type: 'spell' });
  s = answer(roundTrip(s));
  expect(s.finished).toBe(false);
  expect(s.tasks[s.position].wordId).not.toBe(passed);
  for (let i = 0; !s.finished && i < 10; i++) {
    expect(s.tasks[s.position].wordId).not.toBe(passed);
    s = answer(s, true);
  }
  expect(s.finished).toBe(true);
});
it('未判题和已完成的练习不能重复推进', () => {
  const s = spelling();
  expect(advanceSession(s)).toBe(s);
  const done = { ...s, finished: true };
  expect(advanceSession(done)).toBe(done);
});
