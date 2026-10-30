import { describe, it, expect } from 'vitest';
import { parseRows, parseText, DEMO } from '../src/parser';
import {
  advanceSession,
  answerSession,
  createSession,
  emptyData,
  finishSession,
  normalize,
  spellingAnswer,
} from '../src/model';
import type { Word } from '../src/model';
import { validateData } from '../src/storage';
const w: Word = {
  id: 'w1',
  deckId: 'd1',
  term: 'ett äpple',
  meaning: '苹果',
  note: '',
  source: 'ett äpple 苹果',
  location: 'test',
  favorite: false,
  due: null,
  interval: 0,
  sessions: 0,
};
describe('笔记整理', () => {
  it('配对混乱分隔符，保留词形和原文', () => {
    const rows = parseText(
      'en bok - 书，böcker\näta / 吃 / åt / ätit\nfika：喝咖啡小憩\nvacker 美丽的',
    );
    expect(rows.map((r) => [r.term, r.meaning, r.note])).toEqual([
      ['en bok', '书', 'böcker'],
      ['äta', '吃', 'åt · ätit'],
      ['fika', '喝咖啡小憩', ''],
      ['vacker', '美丽的', ''],
    ]);
    expect(rows[0].source).toBe('en bok - 书，böcker');
  });
  it('配对跨行释义且保留来源行号', () => {
    const [r] = parseText('läsa\n阅读');
    expect(r.term).toBe('läsa');
    expect(r.meaning).toBe('阅读');
    expect(r.location).toContain('第 1 行');
    expect(r.source).toBe('läsa\n阅读');
  });
  it('缺释义和句子保留待检查，不静默丢弃', () => {
    const rows = parseText(DEMO);
    expect(rows.filter((r) => r.selected)).toHaveLength(12);
    expect(rows.find((r) => r.term.startsWith('Jag'))?.selected).toBe(false);
    expect(rows.find((r) => r.term === 'behöver kolla med läraren')?.issue).toContain('缺少释义');
    expect(rows.length).toBe(15);
  });
  it('按表头映射颠倒列，同时保留多义词', () => {
    const rows = parseRows(
      [
        ['中文', '备注', '瑞典语'],
        ['苹果', '复数 äpplen', 'ett äpple'],
        ['弓', '同形异义', 'en båge'],
      ],
      'sheet',
    );
    expect(rows[0].term).toBe('ett äpple');
    expect(rows[0].meaning).toBe('苹果');
    expect(rows[0].note).toBe('复数 äpplen');
    expect(rows[0].location).toContain('第 2 行');
  });
  it('无表头双列表格及独立缺失行不会丢弃', () => {
    const rows = parseRows(
      [
        ['bok', '书'],
        ['fika', ''],
      ],
      'sheet',
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].selected).toBe(false);
  });
});
describe('拼写和练习状态', () => {
  it('变音符号严格区分，同时处理 Unicode 与多余空格', () => {
    expect(normalize(' a\u0308pple ')).toBe(normalize('äpple'));
    expect(normalize('apple')).not.toBe(normalize('äpple'));
    expect(spellingAnswer(w)).toBe('äpple');
    expect(normalize('TYCKA   OM')).toBe('tycka om');
  });
  it('题目不足时不凑虚假干扰项', () => {
    const s = createSession([w], [w]);
    expect(s.tasks[0].options).toEqual([]);
  });
  it('提示后的正确不算独立正确，反复练习不会提前结束', () => {
    let s = createSession([w], [w]);
    s = advanceSession(answerSession(s, w, '苹果'));
    let steps = 0;
    while (!s.finished && steps++ < 20) {
      s = advanceSession(answerSession({ ...s, hinted: true }, w, 'äpple'));
    }
    expect(s.finished).toBe(false);
    expect(s.scores[w.id]).toMatchObject({ wins: 0, tries: 20, hints: 20 });
  });
  it('只认对选择题不能获得拼写掌握，错词有机会再次独立答对', () => {
    let s = createSession([w], [w]);
    s = advanceSession(answerSession(s, w, '苹果'));
    s = advanceSession(answerSession(s, w, 'apple'));
    while (!s.finished) s = advanceSession(answerSession(s, w, 'äpple'));
    expect(s.scores.w1).toMatchObject({ wins: 2, tries: 3, misses: 1 });
  });
  it('重复提交不增加计分，重复完成不增加历史', () => {
    let s = createSession([w], [w]);
    s = advanceSession(answerSession(s, w, '苹果'));
    const first = answerSession(s, w, 'äpple');
    expect(answerSession(first, w, 'äpple').scores.w1.tries).toBe(1);
    s = advanceSession(first);
    s = advanceSession(answerSession(s, w, 'äpple'));
    const d = finishSession(
      { ...emptyData(), words: [w], decks: [{ id: 'd1', name: 'test', created: 1, pending: [] }] },
      s,
    );
    expect(d.words[0].interval).toBe(1);
    expect(d.words[0].sessions).toBe(1);
    expect(finishSession(d, s).history).toHaveLength(1);
    expect(finishSession(d, s).words[0].sessions).toBe(1);
    expect(d.words[0].due).toBeGreaterThan(Date.now());
  });
});
describe('备份完整性', () => {
  it('完整备份可恢复，未知版本及破损关联会被拒绝', () => {
    const data = {
      ...emptyData(),
      words: [w],
      decks: [{ id: 'd1', name: 'test', created: 1, pending: [] }],
    };
    expect(validateData(JSON.parse(JSON.stringify(data)))).toEqual({
      ...data,
      words: [{ ...w, group: 1 }],
    });
    expect(() => validateData({ ...data, version: 2 })).toThrow();
    expect(() => validateData({ ...data, decks: [] })).toThrow();
    expect(() =>
      validateData({ ...data, session: { ...createSession([w], [w]), position: 999 } }),
    ).toThrow();
  });
});
