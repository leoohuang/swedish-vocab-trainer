import { afterEach, expect, it } from 'vitest';
import { setLanguage, t } from '../src/i18n';
import messages from '../src/translations.en.json';
afterEach(() => setLanguage('zh'));
it('翻译带参数的界面文案，参数里的瑞典语和个人命名保持原样', () => {
  setLanguage('en');
  expect(t('已新建词库「{0}」，原有词库已保留', '我的单元 · äpple')).toBe(
    'Created deck “我的单元 · äpple”. Existing decks are kept',
  );
  expect(t('朗读 {0}', 'ett äpple')).toBe('Read aloud ett äpple');
  setLanguage('zh');
  expect(t('朗读 {0}', 'ett äpple')).toBe('朗读 ett äpple');
});
it('英语参数占位符与中文一致，翻译不会遗失计数或题目信息', () => {
  for (const [source, translated] of Object.entries(messages)) {
    expect((translated.match(/\{\d+\}/g) || []).sort(), source).toEqual(
      (source.match(/\{\d+\}/g) || []).sort(),
    );
  }
});
it('保留分段文字间隔，未登记的数据不会被自动改写', () => {
  setLanguage('en');
  expect(t('已过关 ')).toBe('Passed ');
  expect(t('苹果、书')).toBe('苹果、书');
});
