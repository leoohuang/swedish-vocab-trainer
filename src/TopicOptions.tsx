import { t } from './i18n';
import { RefreshCw, Sparkles } from 'lucide-react';
import type { AiStatus } from './ai-client';
import type { TopicRequest } from '../shared/ai';
export type TopicOptions = Omit<TopicRequest, 'consent'> & { consent: boolean };
export const defaultTopicOptions = (): TopicOptions => ({
  topic: '',
  sfiLevel: 'B',
  count: 10,
  consent: false,
});
export function TopicGenerator({
  options,
  onChange,
  status,
  onRefresh,
  disabled,
}: {
  options: TopicOptions;
  onChange: (patch: Partial<TopicOptions>) => void;
  status: AiStatus | null;
  onRefresh: () => void;
  disabled: boolean;
}) {
  return (
    <section className="topic-generator" aria-label={t('主题词表设置')}>
      <div className="topic-intro">
        <Sparkles size={21} />
        <div>
          <strong>{t('从一个想聊的话题开始')}</strong>
          <p>{t('不用准备文件。选择今天的场景，让 AI 帮你整理一组可以马上练的词。')}</p>
        </div>
      </div>
      <fieldset disabled={disabled}>
        <legend className="sr-only">{t('主题与 SFI 课程')}</legend>
        <label className="topic-field">
          {t('想学习什么主题？')}
          <input
            aria-label={t('词表主题')}
            maxLength={160}
            placeholder={t('例如：看病就医、找工作、在超市购物')}
            value={options.topic}
            onChange={(e) => onChange({ topic: e.target.value })}
          />
        </label>
        <div className="topic-suggestions" aria-label={t('主题建议')}>
          {[
            t('看病就医'),
            t('找工作'),
            t('超市购物'),
            t('住房与租房'),
            t('学校与家长会'),
            t('交通出行'),
          ].map((topic) => (
            <button
              key={topic}
              type="button"
              className="topic-chip"
              onClick={() => onChange({ topic })}
            >
              {topic}
            </button>
          ))}
        </div>
        <div className="ai-config-row">
          <label>
            {t('SFI 课程')}
            <select
              aria-label={t('SFI 课程')}
              value={options.sfiLevel}
              onChange={(e) => onChange({ sfiLevel: e.target.value as TopicOptions['sfiLevel'] })}
            >
              {(['A', 'B', 'C', 'D'] as const).map((level) => (
                <option key={level} value={level}>
                  SFI {level}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('生成词数')}
            <select
              aria-label={t('生成词数')}
              value={options.count}
              onChange={(e) => onChange({ count: Number(e.target.value) })}
            >
              {[5, 10, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                  {t(' 个词')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="ai-mode-help">
          {t(
            '按课程调整词汇、搭配和例句难度。SFI A / B 侧重熟悉的日常表达，C / D 逐步增加工作与社会生活语境；不是官方指定词表。',
          )}
        </p>
        <div className="topic-service">
          <span>
            {status
              ? status.configured
                ? `${status.provider} · ${status.model}`
                : t('尚未填写 API 密钥，请打开上方 AI 设置。')
              : t('正在读取 AI 配置…')}
          </span>
          <button type="button" className="text-button" onClick={onRefresh}>
            <RefreshCw size={14} />
            {t('刷新状态')}
          </button>
        </div>
        <label className="known-check">
          <input
            type="checkbox"
            checked={options.consent}
            onChange={(e) => onChange({ consent: e.target.checked })}
          />
          {t('同意将本次主题、SFI 课程和词数发送至 ')}
          {status?.provider || t('配置的模型服务')}
          {t('；不发送已有词库和学习记录。')}
        </label>
      </fieldset>
    </section>
  );
}
