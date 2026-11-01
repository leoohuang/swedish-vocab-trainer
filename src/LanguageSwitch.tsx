import { getLanguage, setLanguage, useLanguage } from './i18n';
export function LanguageSwitch() {
  useLanguage();
  const language = getLanguage();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={language === 'en' ? 'Interface language' : '界面语言'}
    >
      <button
        type="button"
        lang="zh-CN"
        aria-pressed={language === 'zh'}
        onClick={() => setLanguage('zh')}
      >
        中文
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
    </div>
  );
}
