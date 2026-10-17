import { Volume2 } from 'lucide-react';
import type { AudioSettings } from './audio';
export function SoundSettings({
  settings,
  onChange,
  compact = false,
}: {
  settings: AudioSettings;
  onChange: (patch: Partial<AudioSettings>) => void;
  compact?: boolean;
}) {
  const content = (
    <div className="sound-switches">
      {(
        [
          { key: 'autoPronounce', label: '答对自动朗读', hint: '瑞典语发音' },
          { key: 'typingSound', label: '键盘音效', hint: '轻柔的打字声' },
          { key: 'answerSound', label: '答题音效', hint: '正确与错误提示' },
        ] as const
      ).map((item) => (
        <label key={item.key}>
          <span>
            <strong>{item.label}</strong>
            <small>{item.hint}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label={item.label}
            checked={settings[item.key]}
            onChange={(e) => onChange({ [item.key]: e.target.checked })}
          />
        </label>
      ))}
    </div>
  );
  return compact ? (
    <details className="sound-menu">
      <summary aria-label="声音设置">
        <Volume2 size={17} />
        <span>声音</span>
      </summary>
      {content}
    </details>
  ) : (
    content
  );
}
