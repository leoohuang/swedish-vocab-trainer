import { afterEach, expect, it, vi } from 'vitest';
function audioWindow(state = 'suspended') {
  const starts: number[] = [];
  let finish: (() => void) | undefined;
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class Context {
    state = state;
    currentTime = 1;
    destination = {};
    resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            this.state = 'running';
            resolve();
          };
        }),
    );
    createOscillator() {
      return {
        type: 'sine',
        frequency: parameter(),
        connect() {},
        disconnect() {},
        start: () => starts.push(1),
        stop() {},
        onended: null,
      };
    }
    createGain() {
      return { gain: parameter(), connect() {}, disconnect() {} };
    }
  }
  vi.stubGlobal('window', { AudioContext: Context, setTimeout, clearTimeout });
  return { starts, resume: () => finish?.() };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('暂停的通道恢复完成后才安排答题音效', async () => {
  const env = audioWindow();
  const { answerSound } = await import('../src/audio');
  const onError = vi.fn();
  answerSound(true, onError);
  expect(env.starts).toHaveLength(0);
  env.resume();
  await Promise.resolve();
  expect(env.starts).toHaveLength(2);
  expect(onError).not.toHaveBeenCalled();
});
it('被系统打断的通道也会恢复，而不是永久静音', async () => {
  const env = audioWindow('interrupted');
  const { answerSound } = await import('../src/audio');
  answerSound(false);
  expect(env.starts).toHaveLength(0);
  env.resume();
  await Promise.resolve();
  expect(env.starts).toHaveLength(1);
});
it('没有可用声音 API 时返回明确错误', async () => {
  vi.stubGlobal('window', {});
  const { answerSound } = await import('../src/audio');
  const onError = vi.fn();
  answerSound(true, onError);
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('无法创建声音通道'));
});
it('语音已就绪时同步调用朗读并恢复暂停队列，保留用户点击上下文', async () => {
  const speak = vi.fn(),
    resume = vi.fn();
  vi.stubGlobal('window', {
    setTimeout,
    speechSynthesis: {
      getVoices: () => [{ name: 'Alva', lang: 'sv-SE' }],
      cancel: vi.fn(),
      speak,
      paused: true,
      resume,
    },
  });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  );
  const { speakSwedish } = await import('../src/audio');
  speakSwedish('en bok', vi.fn());
  expect(resume).toHaveBeenCalledOnce();
  expect(speak).toHaveBeenCalledOnce();
  expect(speak.mock.calls[0][0]).toMatchObject({ text: 'en bok', lang: 'sv-SE', rate: 0.85 });
});
