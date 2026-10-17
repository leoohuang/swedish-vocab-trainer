import type { AiEvidence } from '../shared/ai';
export function AiEvidenceView({ evidence: ai }: { evidence: AiEvidence | undefined }) {
  if (!ai) return null;
  return (
    <div className="ai-evidence">
      <div className="ai-evidence-tags">
        <span>
          {ai.meaningOrigin === 'source'
            ? '原文提供释义'
            : ai.meaningOrigin === 'edited'
              ? '释义已手动修改'
              : 'AI 补充释义 · 请核对'}
        </span>
        {ai.example && <span>例句来自材料</span>}
      </div>
      {ai.reason && (
        <p>
          <b>推荐原因</b>
          {ai.reason}
        </p>
      )}
      {ai.example && (
        <blockquote>
          <span lang="sv">{ai.example}</span>
          {ai.exampleTranslation && <small>AI 译文：{ai.exampleTranslation}</small>}
        </blockquote>
      )}
    </div>
  );
}
