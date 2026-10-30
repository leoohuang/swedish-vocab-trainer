import { useEffect, useState } from 'react';
import { answerSound, audioStatus, speakSwedish, typingSound } from './audio';
export function SoundCheck() {
  const [status, setStatus] = useState(audioStatus);
  const [message, setMessage] = useState('点击下面的按钮，单独检查读音和各类音效。');
  useEffect(() => {
    const refresh = () => setStatus(audioStatus());
    const timer = window.setInterval(refresh, 800);
    window.speechSynthesis?.addEventListener('voiceschanged', refresh);
    return () => {
      clearInterval(timer);
      window.speechSynthesis?.removeEventListener('voiceschanged', refresh);
    };
  }, []);
  function testEffect(kind: 'typing' | 'correct' | 'wrong') {
    setMessage('已请求播放测试音。若仍听不到，请检查浏览器标签页和设备是否静音。');
    if (kind === 'typing') typingSound(setMessage);
    else answerSound(kind === 'correct', setMessage);
    setStatus(audioStatus());
  }
  return (
    <div className="sound-check" aria-label="声音检查">
      <div className="sound-check-buttons">
        <button
          className="button secondary"
          onClick={() => {
            setMessage('正在启动瑞典语朗读…');
            speakSwedish('Hej! Välkommen till din svenska träning.', setMessage, (voice) =>
              setMessage(`瑞典语朗读已启动：${voice}。若听不到，请检查设备或标签页静音。`),
            );
          }}
        >
          测试读音
        </button>
        <button className="button secondary" onClick={() => testEffect('typing')}>
          测试键盘音
        </button>
        <button className="button secondary" onClick={() => testEffect('correct')}>
          测试正确音
        </button>
        <button className="button secondary" onClick={() => testEffect('wrong')}>
          测试错误音
        </button>
      </div>
      <p className="sound-check-state">
        音效通道：
        {!status.effectsSupported
          ? '浏览器不支持'
          : status.state === 'running'
            ? '已启用'
            : '等待点击启用'}
      </p>
      <p className="sound-check-state">
        瑞典语语音：
        {!status.speechSupported
          ? '浏览器不支持'
          : status.voices.length
            ? status.voices.join('、')
            : '尚未检测到，点击“测试读音”重试'}
      </p>
      <p aria-live="polite" aria-label="声音检查结果" className="sound-check-message">
        {message}
      </p>
    </div>
  );
}
