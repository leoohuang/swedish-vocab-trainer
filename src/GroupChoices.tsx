import { t } from './i18n';
import { Check, ArrowRight, Layers, RefreshCw, Clock3 } from 'lucide-react';
import { groupWords } from './groups';
import type { StudyGroup } from './groups';
export function GroupChoices({
  groups,
  selectedKey,
  onChoose,
  review = false,
  allReview = false,
}: {
  groups: StudyGroup[];
  selectedKey: string | null;
  onChoose: (group: StudyGroup) => void;
  review?: boolean;
  allReview?: boolean;
}) {
  const chosen = groups.find((g) => g.key === selectedKey);
  const reviewing = review || allReview;
  const practiceWords = (group: StudyGroup) =>
    allReview ? group.words : groupWords(group, review);
  return (
    <div className={`group-choices ${reviewing ? 'review-choices' : ''}`}>
      <div className="group-plan-heading">
        <span className="group-plan-icon" aria-hidden="true">
          {reviewing ? <RefreshCw size={21} /> : <Layers size={21} />}
        </span>
        <div>
          <strong>
            {reviewing
              ? t('选一组，再记牢一点')
              : chosen
                ? t('已为你选好第 {0} 组', String(chosen.number).padStart(2, '0'))
                : t('这些词都已经过关了')}
          </strong>
          <p>
            {reviewing
              ? t('每个词独立拼对两次，完成本轮复习。')
              : chosen
                ? chosen.completed
                  ? t('这组已过关，本次将重新练习。')
                  : t('每组 10 个，学完自动接着下一组。')
                : t('可以选择一组重新练习，或等到复习时间再来。')}
          </p>
        </div>
      </div>
      <div className="study-group-grid">
        {groups.map((g) => {
          const selected = g.key === selectedKey;
          const count = practiceWords(g).length;
          const status = reviewing
            ? g.dueCount
              ? t('{0} 词到期', g.dueCount)
              : t('随时可练')
            : g.completed
              ? t('已过关')
              : g.remaining.length === g.words.length
                ? t('未学习')
                : t('进行中');
          return (
            <button
              key={g.key}
              type="button"
              className={`study-group ${selected ? 'chosen' : ''} ${g.completed && !reviewing ? 'completed' : ''} ${reviewing ? 'review-group' : ''}`}
              aria-pressed={selected}
              aria-label={t('第 {0} 组 · {1} · {2}', g.number, g.deckName, status)}
              onClick={() => onChoose(g)}
            >
              <div className="study-group-top">
                <span className={reviewing && g.dueCount ? 'group-state due' : 'group-state'}>
                  {reviewing && g.dueCount > 0 && <Clock3 size={12} aria-hidden="true" />}
                  {status}
                </span>
                <span className="group-selection" aria-hidden="true">
                  {selected ? <Check size={14} /> : <span className="group-dot" />}
                </span>
              </div>
              <h3>
                {t('第 {0} 组', g.number)}
                <small>{t('{0} 个词', count)}</small>
              </h3>
              <div className="study-group-terms" lang="sv">
                {practiceWords(g)
                  .slice(0, 3)
                  .map((w) => w.term)
                  .join(' · ')}
                {count > 3 ? ' …' : ''}
              </div>
              <div className="study-group-bottom">
                <span>
                  {selected
                    ? t('已选中')
                    : reviewing
                      ? t('选择这组')
                      : g.completed
                        ? t('已过关 · 可重练')
                        : t(
                            '已过关 {0} / {1}',
                            g.words.length - g.remaining.length,
                            g.words.length,
                          )}
                </span>
                <ArrowRight size={14} aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>
      {chosen && (
        <details className="group-preview" open>
          <summary>
            {t('本次练习')} · {t('第 {0} 组', chosen.number)} ·{' '}
            {t('{0} 个词', practiceWords(chosen).length)}
          </summary>
          <div lang="sv">
            {practiceWords(chosen).map((w) => (
              <span key={w.id}>{w.term}</span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
