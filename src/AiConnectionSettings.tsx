import { useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { clearAiKey, setAiConnection, useAiConnection } from './ai-connection';
import { t } from './i18n';
export function AiConnectionSettings({ compact = false }: { compact?: boolean }) {
  const current = useAiConnection();
  const [draft, setDraft] = useState(current);
  const [provider, setProvider] = useState(
    current.baseURL === 'https://api.openai.com/v1' ? 'openai' : 'custom',
  );
  const [message, setMessage] = useState('');
  const form = (
    <form
      className="ai-connection-form"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          setAiConnection(draft);
          setMessage('本页已启用你的 API 设置；密钥未保存到浏览器存储。实际调用时由服务商验证。');
        } catch {
          setMessage(
            'API 设置不完整。请检查密钥、模型名称和不含账号或参数的 HTTPS Base URL（443 端口）。',
          );
        }
      }}
    >
      <p>
        {t(
          'AI 调用使用你的账户额度。密钥仅保留在本页内存，刷新后清除，不进入词库、导出文件或浏览器存储。',
        )}
      </p>
      <p>{t('请求时密钥和本次材料会经过本站后端，转发给你填写的服务商。请只填写你信任的接口。')}</p>
      <div className="ai-connection-fields">
        <label>
          {t('API 服务商')}
          <select
            aria-label={t('API 服务商')}
            value={provider}
            onChange={(event) => {
              const value = event.target.value;
              setProvider(value);
              setDraft((old) => ({
                ...old,
                baseURL: value === 'openai' ? 'https://api.openai.com/v1' : '',
                style: value === 'openai' ? 'responses' : 'chat',
              }));
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="custom">{t('自定义 OpenAI 兼容接口')}</option>
          </select>
        </label>
        <label>
          Base URL
          <input
            aria-label="Base URL"
            type="url"
            required
            maxLength={2000}
            value={draft.baseURL}
            onChange={(event) => setDraft({ ...draft, baseURL: event.target.value })}
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
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            placeholder="gpt-4.1-mini"
          />
        </label>
        <label>
          {t('接口格式')}
          <select
            aria-label={t('接口格式')}
            value={draft.style}
            onChange={(event) =>
              setDraft({ ...draft, style: event.target.value as 'responses' | 'chat' })
            }
          >
            <option value="responses">Responses API</option>
            <option value="chat">Chat Completions</option>
          </select>
        </label>
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
          onChange={(event) => setDraft({ ...draft, key: event.target.value })}
          placeholder={t('填写你自己的 API 密钥')}
        />
      </label>
      <p className="ai-connection-help">
        {t(
          'Base URL 填写 API 根路径（如 /v1），不要包含 /responses 或 /chat/completions。自定义模型需支持 JSON Schema 结构化输出；不支持本机或内网接口。',
        )}
      </p>
      <div className="ai-connection-actions">
        <button className="button primary" type="submit">
          {t('在本页使用此 API')}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            clearAiKey();
            setDraft({ ...draft, key: '' });
            setMessage('本页 API 密钥已清除。');
          }}
        >
          <Trash2 size={15} />
          {t('清除密钥')}
        </button>
      </div>
      <p aria-live="polite" className="ai-connection-message">
        {message
          ? t(message)
          : current.key
            ? t('已填写个人 API 密钥（尚未验证）')
            : t('尚未填写个人 API 密钥；本机规则整理仍可使用。')}
      </p>
    </form>
  );
  return compact ? (
    <details className="ai-connection-setting">
      <summary>
        <KeyRound size={16} />
        {t('使用自己的 API / AI 设置')}
      </summary>
      {form}
    </details>
  ) : (
    <article className="setting-card ai-connection-setting">
      <KeyRound size={28} />
      <h2>{t('个人 AI 设置')}</h2>
      {form}
    </article>
  );
}
