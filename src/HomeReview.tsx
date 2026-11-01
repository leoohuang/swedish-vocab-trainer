import { ArrowRight, Clock3, RefreshCw } from 'lucide-react';
export function HomeReview({
  deckName,
  due,
  learned,
  active,
  onDue,
  onLearned,
  onResume,
}: {
  deckName: string;
  due: number;
  learned: number;
  active: boolean;
  onDue: () => void;
  onLearned: () => void;
  onResume: () => void;
}) {
  return (
    <section className="home-review" aria-labelledby="home-review-title">
      <div className="home-review-heading">
        <div>
          <span className="eyebrow">LITE IGEN · 再记一次</span>
          <h2 id="home-review-title">温故，才能记得更久。</h2>
        </div>
        <span className="home-review-scope">当前词库 · {deckName}</span>
      </div>
      <div className="home-review-options">
        <article>
          <Clock3 size={23} aria-hidden="true" />
          <div>
            <h3>
              到期复习 <span>{due} 词</span>
            </h3>
            <p>
              {due
                ? '这些词到了复习时间，今天再记一遍。'
                : '今天没有到期单词，也可以主动巩固练过的词。'}
            </p>
          </div>
          <button className="button primary" onClick={onDue} disabled={!due || active}>
            复习到期单词
            <ArrowRight size={16} />
          </button>
        </article>
        <article>
          <RefreshCw size={23} aria-hidden="true" />
          <div>
            <h3>
              主动巩固 <span>{learned} 词</span>
            </h3>
            <p>
              {learned
                ? '不用等到期，按组重练已经练过的词。'
                : '完成一轮学习后，练过的词会出现在这里。'}
            </p>
          </div>
          <button className="button secondary" onClick={onLearned} disabled={!learned || active}>
            巩固练过的词
            <ArrowRight size={16} />
          </button>
        </article>
      </div>
      {active && (
        <div className="home-review-pending">
          <span>你还有一轮未完成，先完成当前练习，再开始复习。</span>
          <button className="text-button" onClick={onResume}>
            继续当前练习
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      <p className="home-review-rule">
        每组最多 10 个词，仍需每词独立拼对两次才过关。复习记录会保存，词库选择保持不变。
      </p>
    </section>
  );
}
