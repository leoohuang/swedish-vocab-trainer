import { useState } from 'react';
import { KeyRound, Trash2, Settings2, Check } from 'lucide-react';
import { clearAiKey, setAiConnection, useAiConnection, remembersAiKey } from './ai-connection';
import { providers, providerFor } from '../shared/providers';
import type { ProviderId } from '../shared/providers';
import openaiLogo from './assets/providers/openai.svg';
import anthropicLogo from './assets/providers/anthropic.svg';
import { t } from './i18n';
export function ProviderLogo({ provider }: { provider: ProviderId }) {
  return provider === 'custom' ? (
    <Settings2 size={24} aria-hidden="true" />
  ) : (
    <img src={provider === 'openai' ? openaiLogo : anthropicLogo} alt="" width="28" height="28" />
  );
}
export function AiConnectionSummary({ onManage }: { onManage: () => void }) {
  const connection = useAiConnection();
  const provider = providers.find((p) => p.id === providerFor(connection))!;
  return (
    <div className="ai-connection-summary">
      <span className="provider-logo">
        <ProviderLogo provider={provider.id} />
      </span>
      <div>
        <strong>
          {connection.key ? `${t(provider.name)} · ${t('已设置')}` : t('先设置 AI 服务')}
        </strong>
        <p>
          {connection.key
            ? t('本次使用已保存的设置，无需重复输入密钥。')
            : t('选择服务商并填写 API Key，只需设置一次。')}
        </p>
      </div>
      <button type="button" className="text-button" onClick={onManage}>
        {t(connection.key ? '修改 AI 设置' : '打开 AI 设置')}
      </button>
    </div>
  );
}
export function AiConnectionSettings({ onSaved }: { onSaved?: () => void }) {
  const current = useAiConnection();
  const [draft, setDraft] = useState(current);
  const [provider, setProvider] = useState<ProviderId>(providerFor(current));
  const [remember, setRemember] = useState(current.key ? remembersAiKey() : true);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <article className="setting-card ai-connection-setting">
      <KeyRound size={28} />
      <h2>{t('AI 服务')}</h2>
      <p>{t('选择服务商，填入 API Key，即可整理笔记和生成词表。')}</p>
      <form
        className="ai-connection-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            setAiConnection(draft, remember);
            setSaved(true);
            setMessage(
              remember ? 'AI 设置已保存，之后无需重复填写。' : 'AI 设置已启用，仅用于本次页面。',
            );
            onSaved?.();
          } catch {
            setSaved(false);
            setMessage('设置未保存，请检查密钥及高级设置；浏览器不允许保存时可关闭记住选项。');
          }
        }}
      >
        <div className="provider-choices" role="group" aria-label={t('API 服务商')}>
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={provider === p.id}
              className={`provider-choice ${provider === p.id ? 'selected' : ''}`}
              onClick={() => {
                if (provider === p.id) return;
                setProvider(p.id);
                setDraft({ key: '', model: p.model, baseURL: p.baseURL, style: p.style });
                setSaved(false);
                setMessage('');
              }}
            >
              <ProviderLogo provider={p.id} />
              <span>{t(p.name)}</span>
              {provider === p.id && <Check size={13} />}
            </button>
          ))}
        </div>
        <label>
          API Key
          <input
            aria-label="API Key"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            maxLength={4096}
            value={draft.key}
            onChange={(e) => {
              setDraft({ ...draft, key: e.target.value });
              setSaved(false);
              setMessage('');
            }}
            placeholder={t('粘贴所选服务商的 API Key')}
          />
        </label>
        <label className="remember-ai-key">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>
            {t('记住此设备，下次自动使用')}
            <small>{t('密钥会保存在此浏览器。仅在你信任的个人设备上开启。')}</small>
          </span>
        </label>
        <details className="ai-advanced" open={provider === 'custom' || undefined}>
          <summary>
            {t('高级设置')} · {provider === 'custom' ? t('填写兼容接口') : draft.model}
          </summary>
          <div className="ai-connection-fields">
            <label>
              Base URL
              <input
                aria-label="Base URL"
                type="url"
                required
                maxLength={2000}
                value={draft.baseURL}
                onChange={(e) => setDraft({ ...draft, baseURL: e.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </label>
            <label>
              {t('模型名称')}
              <input
                aria-label={t('模型名称')}
                required
                maxLength={200}
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              />
            </label>
            <label>
              {t('接口格式')}
              <select
                aria-label={t('接口格式')}
                value={draft.style}
                onChange={(e) =>
                  setDraft({ ...draft, style: e.target.value as typeof draft.style })
                }
              >
                <option value="responses">OpenAI Responses</option>
                <option value="chat">OpenAI Chat Completions</option>
                <option value="anthropic">Anthropic Messages</option>
              </select>
            </label>
          </div>
          <p>{t('自定义接口需使用公开 HTTPS 域名，并支持 JSON Schema 结构化输出。')}</p>
        </details>
        <p className="ai-connection-help">
          {t(
            '费用使用你的 API 账户额度。请求经本站后端转发给所选服务商；密钥不进入词库备份，服务器不保存密钥。',
          )}
        </p>
        <div className="ai-connection-actions">
          <button className="button primary" type="submit">
            {t('保存 AI 设置')}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              clearAiKey();
              setDraft({ ...draft, key: '' });
              setSaved(false);
              setMessage('API 密钥已从本页和此设备清除。');
            }}
          >
            <Trash2 size={15} />
            {t('清除密钥')}
          </button>
        </div>
        <p aria-live="polite" className={`ai-connection-message ${saved ? 'saved' : ''}`}>
          {message
            ? t(message)
            : current.key
              ? t('已设置；实际调用时验证密钥和账户额度。')
              : t('尚未设置；本机规则整理仍可使用。')}
        </p>
      </form>
    </article>
  );
}
