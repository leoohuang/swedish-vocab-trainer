export type AudioSettings = { typingSound: boolean; answerSound: boolean; autoPronounce: boolean };
export const DEFAULT_AUDIO: AudioSettings = {
  typingSound: true,
  answerSound: true,
  autoPronounce: true,
};
let context: AudioContext | undefined,
  lastKey = -Infinity;
function audioContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return;
  const Constructor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return;
  try {
    if (!context || context.state === 'closed') context = new Constructor();
    return context;
  } catch {
    return;
  }
}
export function unlockAudio() {
  const ctx = audioContext();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
}
function tone(
  ctx: AudioContext,
  frequency: number,
  endFrequency: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}
export function typingSound() {
  const ctx = audioContext();
  if (!ctx) return;
  unlockAudio();
  if (ctx.currentTime - lastKey < 0.025) return;
  lastKey = ctx.currentTime;
  const duration = 0.026,
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate),
    channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++)
    channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / channel.length, 3);
  const source = ctx.createBufferSource(),
    filter = ctx.createBiquadFilter(),
    gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.8;
  gain.gain.value = 0.14;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
  tone(ctx, 160, 90, ctx.currentTime, 0.028, 0.035, 'triangle');
}
export function answerSound(correct: boolean) {
  const ctx = audioContext();
  if (!ctx) return;
  unlockAudio();
  const start = ctx.currentTime;
  if (correct) {
    tone(ctx, 660, 660, start, 0.12, 0.11);
    tone(ctx, 990, 990, start + 0.065, 0.16, 0.08);
  } else {
    tone(ctx, 185, 115, start, 0.17, 0.09, 'triangle');
  }
}
let speechGeneration = 0;
let currentUtterance: SpeechSynthesisUtterance | null = null;
export function stopSpeech() {
  speechGeneration++;
  currentUtterance = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.some((v) => v.lang.toLowerCase().startsWith('sv'))) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', changed);
      resolve(synth.getVoices());
    };
    const changed = () => {
      if (synth.getVoices().some((v) => v.lang.toLowerCase().startsWith('sv'))) finish();
    };
    const timer = window.setTimeout(finish, 1500);
    synth.addEventListener('voiceschanged', changed);
  });
}
export function speakSwedish(term: string, onError: (text: string) => void) {
  stopSpeech();
  const generation = speechGeneration;
  if (!('speechSynthesis' in window)) {
    onError('当前浏览器不支持朗读。');
    return;
  }
  void voicesReady()
    .then((voices) => {
      if (generation !== speechGeneration) return;
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith('sv'));
      if (!voice) {
        onError('设备还没有可用的瑞典语语音，请在系统语音设置中添加。');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(term);
      utterance.voice = voice;
      utterance.lang = 'sv-SE';
      utterance.rate = 0.85;
      currentUtterance = utterance;
      utterance.onend = () => {
        if (currentUtterance === utterance) currentUtterance = null;
      };
      utterance.onerror = (e) => {
        if (currentUtterance === utterance) currentUtterance = null;
        if (generation === speechGeneration && !['canceled', 'interrupted'].includes(e.error))
          onError('朗读没有成功，请检查设备的语音设置。');
      };
      window.speechSynthesis.speak(utterance);
    })
    .catch(() => onError('朗读暂不可用，请检查设备的语音设置。'));
}
