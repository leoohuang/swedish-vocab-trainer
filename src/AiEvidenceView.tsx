import { t } from './i18n';
import type { AiEvidence } from '../shared/ai';
export function AiEvidenceView({ evidence: ai }: { evidence: AiEvidence | undefined }) {
  if (!ai) return null;
  return (
    <div className="ai-evidence">
      <div className="ai-evidence-tags">
        <span>
          {ai.mode === 'generated'
            ? t('AI 生成词表{0}', ai.sfiLevel ? ` · SFI ${ai.sfiLevel}` : '')
            : ai.meaningOrigin === 'source'
              ? t('原文提供释义')
              : ai.meaningOrigin === 'edited'
                ? t('释义已手动修改')
                : t('AI 补充释义 · 请核对')}
        </span>
        {ai.mode === 'generated' && ai.meaningOrigin === 'edited' && (
          <span>{t('释义已手动修改')}</span>
        )}
        {ai.example && (
          <span>{ai.mode === 'generated' ? t('AI 生成例句 · 请核对') : t('例句来自材料')}</span>
        )}
      </div>
      {ai.reason && (
        <p>
          <b>{t('推荐原因')}</b>
          {ai.reason}
        </p>
      )}
      {ai.example && (
        <blockquote>
          <span lang="sv">{ai.example}</span>
          {ai.exampleTranslation && (
            <small>
              {t('AI 译文：')}
              {ai.exampleTranslation}
            </small>
          )}
        </blockquote>
      )}
    </div>
  );
}
