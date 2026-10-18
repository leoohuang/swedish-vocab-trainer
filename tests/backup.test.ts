import { describe, it, expect } from 'vitest';
import { mergeBackup } from '../src/backup';
import { emptyData, createSession } from '../src/model';
import type { Data } from '../src/model';
function sample(id: string, name = '同名词库'): Data {
  return {
    ...emptyData(),
    decks: [{ id, name, created: 1, pending: [] }],
    words: [
      {
        id: `word-${id}`,
        deckId: id,
        term: 'bok',
        meaning: '书',
        note: '',
        source: '',
        location: '',
        favorite: true,
        due: 100,
        interval: 3,
        sessions: 2,
        group: 1,
      },
    ],
  };
}
describe('合并备份', () => {
  it('保留同名的两个词库、原词条与导入的进度，重复导入不新增', () => {
    const current = sample('a'),
      incoming = sample('b');
    incoming.session = createSession(incoming.words, incoming.words);
    const merged = mergeBackup(current, incoming);
    expect(merged.decks).toHaveLength(2);
    expect(merged.words).toEqual([...current.words, ...incoming.words]);
    expect(merged.session).toEqual(incoming.session);
    expect(mergeBackup(merged, incoming)).toEqual(merged);
    expect(current.decks).toHaveLength(1);
  });
  it('同一词库以当前进度为准，并保留进行中的练习', () => {
    const current = sample('a');
    current.session = createSession(current.words, current.words);
    const incoming = sample('b');
    incoming.session = createSession(incoming.words, incoming.words);
    const merged = mergeBackup(current, incoming);
    expect(merged.session).toEqual(current.session);
    const older = sample('a');
    older.words[0].sessions = 0;
    expect(mergeBackup(current, older).words[0].sessions).toBe(2);
  });
  it('不同词库的词条 ID 冲突时重建 ID，续练关联仍正确', () => {
    const current = sample('a'),
      incoming = sample('b');
    incoming.words[0].id = current.words[0].id;
    incoming.session = createSession(incoming.words, incoming.words);
    const merged = mergeBackup(current, incoming);
    expect(merged.words[1].id).not.toBe(current.words[0].id);
    expect(merged.session!.ids).toEqual([merged.words[1].id]);
    expect(merged.session!.tasks.every((t) => t.wordId === merged.words[1].id)).toBe(true);
  });
});
