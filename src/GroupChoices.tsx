import { Check, ArrowRight, Layers } from 'lucide-react';
import type { StudyGroup } from './groups';
export function GroupChoices({
  groups,
  selectedKey,
  onChoose,
  review = false,
}: {
  groups: StudyGroup[];
  selectedKey: string | null;
  onChoose: (group: StudyGroup) => void;
  review?: boolean;
}) {
  const chosen = groups.find((g) => g.key === selectedKey);
  return (
    <div className="group-choices">
      <div className="group-plan-heading">
        <span className="group-plan-icon">
          <Layers size={21} />
        </span>
        <div>
          <strong>
            {chosen
              ? `已为你选好第 ${String(chosen.number).padStart(2, '0')} 组`
              : '这些词都已经过关了'}
          </strong>
          <p>
            {chosen
              ? review
                ? '这一组有到期单词，准备好就开始复习。'
                : chosen.completed
                  ? '这组已过关，本次将重新练习。'
                  : '每组 10 个，学完自动接着下一组。'
              : '可以选择一组重新练习，或等到复习时间再来。'}
          </p>
        </div>
      </div>
      <div className="study-group-grid">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`study-group ${g.key === selectedKey ? 'chosen' : ''} ${g.completed ? 'completed' : ''}`}
            aria-pressed={g.key === selectedKey}
            aria-label={`第 ${g.number} 组 · ${g.deckName} · ${g.completed ? '已过关' : g.remaining.length === g.words.length ? '未学习' : '进行中'}`}
            onClick={() => onChoose(g)}
          >
            <div className="study-group-top">
              <span>GROUP {String(g.number).padStart(2, '0')}</span>
              {g.completed ? (
                <Check size={16} />
              ) : g.key === selectedKey ? (
                <ArrowRight size={16} />
              ) : (
                <span className="group-dot" />
              )}
            </div>
            <h3>
              第 {g.number} 组 <small>{g.words.length} 个词</small>
            </h3>
            <p>{g.deckName}</p>
            <div className="study-group-terms" lang="sv">
              {g.words
                .slice(0, 3)
                .map((w) => w.term)
                .join(' · ')}
              {g.words.length > 3 ? ' …' : ''}
            </div>
            <div className="study-group-bottom">
              <span>
                {g.completed
                  ? '已过关 · 可重练'
                  : g.remaining.length === g.words.length
                    ? '等待开始'
                    : `已过关 ${g.words.length - g.remaining.length} / ${g.words.length}`}
              </span>
              {g.dueCount > 0 && <span>{g.dueCount} 词待复习</span>}
            </div>
          </button>
        ))}
      </div>
      {chosen && (
        <div className="group-preview">
          <span>本次练习</span>
          <div lang="sv">
            {(review
              ? chosen.words.filter((w) => w.due !== null && w.due <= Date.now())
              : chosen.completed
                ? chosen.words
                : chosen.remaining
            ).map((w) => (
              <span key={w.id}>{w.term}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
