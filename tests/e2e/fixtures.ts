import { test as base, expect } from '@playwright/test';
// Keep automated tests quiet. Web Audio remains real, speech is captured instead of spoken.
export const test = base.extend<{ quietAudio: void }>({
  quietAudio: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        const log = { tones: [] as number[], keys: 0, utterances: [] as string[], cancels: 0 };
        (window as unknown as { __ordAudio: typeof log }).__ordAudio = log;
        class Utterance {
          constructor(public text: string) {}
          lang = '';
          rate = 1;
          voice: unknown = null;
          onerror: unknown = null;
        }
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
          configurable: true,
          value: Utterance,
        });
        Object.defineProperty(window, 'speechSynthesis', {
          configurable: true,
          value: {
            getVoices: () => [{ name: 'Swedish test voice', lang: 'sv-SE' }],
            speak: (u: { text: string }) => log.utterances.push(u.text),
            cancel: () => log.cancels++,
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
        if (window.AudioContext) {
          const Original = window.AudioContext;
          class QuietContext extends Original {
            createOscillator() {
              const node = super.createOscillator();
              const set = node.frequency.setValueAtTime.bind(node.frequency);
              node.frequency.setValueAtTime = (frequency, time) => {
                log.tones.push(frequency);
                return set(frequency, time);
              };
              return node;
            }
            createBufferSource() {
              log.keys++;
              return super.createBufferSource();
            }
          }
          Object.defineProperty(window, 'AudioContext', {
            configurable: true,
            value: QuietContext,
          });
        }
      });
      await use();
    },
    { auto: true },
  ],
});
export { expect };
