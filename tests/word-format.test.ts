import { describe, it, expect } from 'vitest';
import { parseText, parseRows } from '../src/parser';
import { cleanBilingualPair } from '../shared/word-format';
import {
  answerSession,
  createSession,
  emptyData,
  spellingAnswer,
  advanceSession,
} from '../src/model';
import type { Word, Session } from '../src/model';
import { validateData } from '../src/storage';
const sentence = 'Jag måste tvätta kläder idag.';
const meaning = '我今天必须洗衣服。';
const old: Word = {
  id: 'old-word',
  deckId: 'deck',
  group: 3,
  term: sentence + ' (',
  meaning: meaning + ')',
  note: '原备注',
  source: sentence + ' (' + meaning + ')',
  location: '笔记第3行',
  favorite: true,
  due: 123,
  interval: 7,
  sessions: 2,
  passed: false,
};
describe('翻译括号和句末标点', () => {
  it.each([
    ['(', ')'],
    ['（', '）'],
    ['[', ']'],
    ['【', '】'],
  ])('本机导入分离 %s %s 翻译包装，原文和句子确认保留', (open, close) => {
    const source = `${sentence} ${open}${meaning}${close}`;
    const [row] = parseText(source);
    expect(row).toMatchObject({
      term: sentence,
      meaning,
      source,
      selected: false,
      issue: '可能是句子，请确认是否练习',
    });
    expect(parseRows([[sentence + ' ' + open, meaning + close]], '表格')[0]).toMatchObject({
      term: sentence,
      meaning,
    });
  });
  it('保留各自字段内合法括号和缺少另一半的内容，不产生空词条', () => {
    for (const [term, meaning] of [
      ['ta (bussen)', '乘（公交）'],
      ['ett (stort) hus', '一栋（大）房子'],
      ['hej (', '问候'],
      ['(', ')'],
      ['x (y)', '含注释）'],
    ])
      expect(cleanBilingualPair(term, meaning)).toEqual({ term, meaning });
  });
  it('旧词库和待整理词条修复不改变原文、ID、组号、历史或逐词计数', () => {
    let s = createSession([old], [old]);
    s = {
      ...s,
      tasks: [{ wordId: old.id, type: 'spell' }],
      scores: { [old.id]: { wins: 1, tries: 3, misses: 2, hints: 0 } },
    };
    const d = {
      ...emptyData(),
      decks: [
        {
          id: 'deck',
          name: '课文',
          created: 1,
          pending: [{ ...old, id: 'pending', selected: false, issue: '待确认' }],
        },
      ],
      words: [old],
      session: s,
    };
    const fixed = validateData(d);
    expect(fixed.words[0]).toEqual({ ...old, term: sentence, meaning });
    expect(fixed.decks[0].pending[0]).toMatchObject({
      term: sentence,
      meaning,
      source: old.source,
    });
    expect(fixed.session).toEqual(s);
    expect(fixed.history).toEqual([]);
    expect(validateData(fixed)).toEqual(fixed);
  });
  it('句子忽略大小写、空白和末尾句号问号感叹号，拼写仍需两次独立正确', () => {
    expect(spellingAnswer(old)).toBe(sentence);
    let s: Session = {
      ...createSession([old], [old]),
      tasks: [{ wordId: old.id, type: 'spell' as const }],
    };
    s = answerSession(s, old, 'jag  måste tvätta kläder idag');
    expect(s.feedback?.correct).toBe(true);
    expect(s.scores[old.id].wins).toBe(1);
    s = advanceSession(s);
    expect(s.finished).toBe(false);
    s = answerSession(s, old, 'Jag måste tvätta kläder idag!');
    expect(s.scores[old.id].wins).toBe(2);
    expect(advanceSession(s).finished).toBe(true);
  });
  it('错字、漏词和 å ä ö 仍判错，提示正确不计独立拼对', () => {
    const s = {
      ...createSession([old], [old]),
      tasks: [{ wordId: old.id, type: 'spell' as const }],
    };
    for (const answer of [
      'Jag maste tvätta kläder idag.',
      'Jag måste tvatta kläder idag.',
      'Jag måste tvätta idag.',
      'Jag måste tvätta kläder igår.',
    ])
      expect(answerSession(s, old, answer).feedback?.correct).toBe(false);
    expect(answerSession({ ...s, hinted: true }, old, sentence).scores[old.id].wins).toBe(0);
    expect(spellingAnswer({ term: 'ett äpple' })).toBe('äpple');
  });
  it('旧选择题选项同步清理，与修复后的释义一致', () => {
    const s = {
      ...createSession([old], [old]),
      tasks: [{ wordId: old.id, type: 'choice' as const, options: [old.meaning, '另一项'] }],
    };
    const d = validateData({
      ...emptyData(),
      decks: [{ id: 'deck', name: '课文', created: 1, pending: [] }],
      words: [old],
      session: s,
    });
    expect(d.session?.tasks[0].options).toEqual([meaning, '另一项']);
    expect(answerSession(d.session!, d.words[0], meaning).feedback?.correct).toBe(true);
  });
});
