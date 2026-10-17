import { describe, it, expect } from 'vitest';
import { assignWordGroups, groupWords, recommendedGroup, studyGroups } from '../src/groups';
import { validateData } from '../src/storage';
import { emptyData } from '../src/model';
import type { Word } from '../src/model';
const decks = [{ id: 'd', name: '课程词库', created: 1, pending: [] }];
const words = (n: number): Word[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    deckId: 'd',
    term: `ord${i}`,
    meaning: `释义${i}`,
    note: '',
    source: 'synthetic',
    location: 'test',
    favorite: false,
    due: null,
    interval: 0,
    sessions: 0,
  }));
describe('固定分组与继续学习', () => {
  it('50 词固定分成 5 组，初次默认选第 1 组', () => {
    const assigned = assignWordGroups(words(50));
    const groups = studyGroups(assigned, decks);
    expect(groups.map((g) => g.words.length)).toEqual([10, 10, 10, 10, 10]);
    expect(recommendedGroup(groups)?.number).toBe(1);
  });
  it('第一组学过后自动选第 2 组，备份恢复与刷新迁移保留进度', () => {
    const data = {
      ...emptyData(),
      decks,
      words: words(50).map((w, i) => ({ ...w, sessions: i < 10 ? 1 : 0 })),
    };
    const restored = validateData(JSON.parse(JSON.stringify(data)));
    const groups = studyGroups(restored.words, restored.decks);
    expect(groups[0].completed).toBe(true);
    expect(recommendedGroup(groups)?.number).toBe(2);
    expect(groupWords(recommendedGroup(groups)!)).toHaveLength(10);
    expect(restored.words.filter((w) => w.sessions === 1)).toHaveLength(10);
  });
  it('只剩 3 个词也能成组，部分已学的组只默认练剩余新词', () => {
    const assigned = assignWordGroups(words(23).map((w, i) => ({ ...w, sessions: i < 4 ? 1 : 0 })));
    const groups = studyGroups(assigned, decks);
    expect(groups[2].words).toHaveLength(3);
    expect(groupWords(groups[0]).map((w) => w.id)).toEqual(['w4', 'w5', 'w6', 'w7', 'w8', 'w9']);
  });
  it('删除词条不会重排其他组，新增词不会塞回已学过的末组', () => {
    const assigned = assignWordGroups(words(15).map((w) => ({ ...w, sessions: 1 })));
    const kept = assigned.filter((w) => w.id !== 'w0');
    const added = assignWordGroups([...kept, { ...words(1)[0], id: 'new', sessions: 0 }]);
    expect(added.find((w) => w.id === 'w10')?.group).toBe(2);
    expect(added.find((w) => w.id === 'new')?.group).toBe(3);
    expect(studyGroups(added, decks)[0].completed).toBe(true);
  });
  it('再次导入可补满未学的末组，但保持所有已有组号', () => {
    const assigned = assignWordGroups(words(12));
    const added = assignWordGroups([
      ...assigned,
      ...words(9).map((w, i) => ({ ...w, id: `new${i}` })),
    ]);
    expect(added.slice(0, 12).map((w) => w.group)).toEqual(assigned.map((w) => w.group));
    expect(studyGroups(added, decks).map((g) => g.words.length)).toEqual([10, 10, 1]);
  });
  it('全部学过时不自动重复第一组，到期复习独立推荐', () => {
    const groups = studyGroups(
      assignWordGroups(words(20).map((w) => ({ ...w, sessions: 1 }))),
      decks,
    );
    expect(recommendedGroup(groups)).toBeUndefined();
    groups[0].words[0].due = Date.now() - 1000;
    const withDue = studyGroups(
      groups.flatMap((g) => g.words),
      decks,
    );
    expect(recommendedGroup(withDue, true)?.number).toBe(1);
    expect(groupWords(withDue[0], true)).toHaveLength(1);
  });
  it('分组与声音设置一起完整备份，旧备份仍能读取', () => {
    const data = {
      ...emptyData(),
      decks,
      words: assignWordGroups(words(21)),
      audio: { typingSound: false, answerSound: true, autoPronounce: false },
    };
    expect(validateData(JSON.parse(JSON.stringify(data)))).toEqual(data);
    expect(validateData({ ...data, audio: undefined, words: words(21) }).words[20].group).toBe(3);
  });
});
