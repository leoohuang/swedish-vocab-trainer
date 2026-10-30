import { expect, it } from 'vitest';
import {
  answerSession,
  advanceSession,
  createSession,
  emptyData,
  finishSession,
  hasPassed,
  sessionPassed,
} from '../src/model';
import type { Data, Session } from '../src/model';
import { validateData } from '../src/storage';
import { studyGroups, recommendedGroup } from '../src/groups';
const word = {
  id: 'w',
  deckId: 'd',
  term: 'en bok',
  meaning: '书',
  note: '',
  source: '',
  location: '',
  favorite: false,
  due: null,
  interval: 0,
  sessions: 0,
};
function legacy(wins = 0): Data {
  const s = createSession([word], [word]);
  delete s.turn;
  Object.assign(s, { finished: true, position: s.tasks.length, ended: 10 });
  s.scores.w = { wins, tries: 4, misses: 4 - wins, hints: 0 };
  return {
    ...emptyData(),
    words: [{ ...word, sessions: 1 }],
    decks: [{ id: 'd', name: '旧词库', created: 1, pending: [] }],
    session: s,
    history: [
      { id: s.id, date: 10, words: 1, completed: wins >= 2 ? 1 : 0, attempts: 4, correct: wins },
    ],
  };
}
it.each([0, 1])('完成入口拒绝只有 %i 次拼对的假完成，不新增记录或更新复习日期', (wins) => {
  const d = legacy(wins);
  const next = finishSession(d, d.session!);
  expect(next.session?.finished).toBe(false);
  expect(next.session?.scores.w.wins).toBe(wins);
  expect(next.words).toEqual(d.words);
  expect(next.history).toEqual(d.history);
  expect(next.session?.tasks[next.session.position]).toEqual({ wordId: 'w', type: 'spell' });
});
it.each([0, 1])('载入旧版 %i 次正确的已结束练习会恢复未过关词，保留成绩、词库和历史', (wins) => {
  const d = legacy(wins),
    next = validateData(d);
  expect(next.session?.finished).toBe(false);
  expect(next.session?.ended).toBeUndefined();
  expect(next.words[0].sessions).toBe(1);
  expect(hasPassed(next.words[0])).toBe(false);
  expect(next.history).toEqual(d.history);
  expect(recommendedGroup(studyGroups(next.words, next.decks))?.number).toBe(1);
  let s = next.session!;
  while (!s.finished) s = advanceSession(answerSession(s, word, 'bok'));
  const done = finishSession(next, s);
  expect(sessionPassed(done.session!)).toBe(true);
  expect(done.words[0]).toMatchObject({ passed: true, sessions: 1 });
  expect(done.history).toHaveLength(1);
  expect(done.history[0].completed).toBe(1);
  expect(finishSession(done, s)).toEqual(done);
});
it('只有旧练习次数，没有逐词结果，不能推断为已过关；旧数据不被清空', () => {
  const d = legacy();
  d.session = null;
  const next = validateData(d);
  expect(hasPassed(next.words[0])).toBe(false);
  expect(next.words[0].sessions).toBe(1);
  expect(next.history).toEqual(d.history);
  expect(studyGroups(next.words, next.decks)[0].completed).toBe(false);
});
it('旧版保留的逐词结果可证明两次拼对时，保留真实过关状态', () => {
  const next = validateData(legacy(2));
  expect(next.session?.finished).toBe(true);
  expect(hasPassed(next.words[0])).toBe(true);
  expect(studyGroups(next.words, next.decks)[0].completed).toBe(true);
});
it('不能将另一道题的答案计入当前单词', () => {
  const d = legacy();
  const s = { ...d.session!, finished: false, position: 0 } as Session;
  expect(answerSession(s, { ...word, id: 'other' }, '书')).toBe(s);
});
