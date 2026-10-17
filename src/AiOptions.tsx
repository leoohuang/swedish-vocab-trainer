import { Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AiStatus, ImportOptions } from './ai-client';
export function AiOptions({
  options: o,
  onChange,
  status,
  onRefresh,
  disabled,
}: {
  options: ImportOptions;
  onChange: (patch: Partial<ImportOptions>) => void;
  status: AiStatus | null;
  onRefresh: () => void;
  disabled: boolean;
}) {
  return (
    <section className="ai-options" aria-label="材料整理设置">
      <div className="ai-options-title">
        <Sparkles size={18} />
        <strong>让材料变成适合你的词库</strong>
        <span className="tag">AI 整理</span>
      </div>
      <fieldset disabled={disabled}>
        <legend className="sr-only">整理引擎</legend>
        <div className="engine-switch">
          <label>
            <input
              type="radio"
              name="engine"
              value="ai"
              checked={o.engine === 'ai'}
              onChange={() => onChange({ engine: 'ai' })}
            />
            AI 理解材料
          </label>
          <label>
            <input
              type="radio"
              name="engine"
              value="local"
              checked={o.engine === 'local'}
              onChange={() => onChange({ engine: 'local' })}
            />
            本机规则整理
          </label>
        </div>
        {o.engine === 'ai' ? (
          <>
            <div className="ai-config-row">
              <label>
                材料类型
                <select
                  aria-label="材料类型"
                  value={o.mode}
                  onChange={(e) => onChange({ mode: e.target.value as ImportOptions['mode'] })}
                >
                  <option value="auto">自动判断</option>
                  <option value="vocabulary">单词合集 · 完整整理</option>
                  <option value="article">课文文章 · 推荐重点词</option>
                  <option value="mixed">混合笔记 · 分类整理</option>
                </select>
              </label>
              <label>
                学习水平
                <select
                  aria-label="学习水平"
                  value={o.level}
                  onChange={(e) => onChange({ level: e.target.value as ImportOptions['level'] })}
                >
                  <option value="beginner">初学 · A1–A2</option>
                  <option value="intermediate">中级 · B1–B2</option>
                  <option value="advanced">进阶 · C1+</option>
                </select>
              </label>
              <label>
                课文推荐词数
                <select
                  aria-label="课文推荐词数"
                  value={o.count}
                  disabled={o.mode === 'vocabulary' || o.mode === 'mixed'}
                  onChange={(e) => onChange({ count: Number(e.target.value) })}
                >
                  {[5, 10, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} 个词
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="ai-mode-help">
              {o.mode === 'vocabulary' || o.mode === 'mixed'
                ? '保留明确出现的词条，不按目标词数删减；无法判断的内容留下核对。'
                : '课文按水平挑选实用词与完整短语。目标词数仅用于课文；自动识别为词汇合集时完整整理。'}
            </p>
            <label className="known-check">
              <input
                type="checkbox"
                checked={o.skipKnown}
                disabled={o.mode === 'vocabulary' || o.mode === 'mixed'}
                onChange={(e) => onChange({ skipKnown: e.target.checked })}
              />
              课文跳过已练过的词（会发送最多 2000 个已练词条辅助筛选）
            </label>
            <div className={`ai-service ${status?.configured ? 'configured' : ''}`}>
              <span>
                {status?.configured
                  ? `${status.provider} · ${status.model}`
                  : '尚未配置 AI 密钥：在项目 .env.local 中填写 OPENAI_API_KEY。'}
              </span>
              <button type="button" className="text-button" onClick={onRefresh}>
                <RefreshCw size={13} />
                刷新状态
              </button>
            </div>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={o.consent}
                onChange={(e) => onChange({ consent: e.target.checked })}
              />
              <span>
                同意将本次材料文字发送至 {status?.provider || '配置的模型服务'}{' '}
                进行整理；不发送文件原件或学习记录。
              </span>
            </label>
          </>
        ) : (
          <p className="ai-mode-help">
            <ShieldCheck size={14} />
            适合分隔清楚的单词表；只在本机处理，不理解课文，也不补充释义。
          </p>
        )}
      </fieldset>
    </section>
  );
}
