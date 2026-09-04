/* ============================================================
   SPEECH LAYER — TTS (speechSynthesis) + STT (SpeechRecognition)
   Abstracted so a cloud provider can replace either later.
   ============================================================ */

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefs = [
    (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang) && /google us english/i.test(v.name),
    (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang) && /natural|aria|jenny|samantha/i.test(v.name),
    (v: SpeechSynthesisVoice) => /en[-_]US/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /^en/i.test(v.lang),
  ];
  for (const test of prefs) {
    const v = voices.find(test);
    if (v) return v;
  }
  return voices[0];
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = pickVoice(); };
  cachedVoice = pickVoice();
}

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, opts: { rate?: number; onend?: () => void } = {}): void {
  if (!ttsAvailable()) { opts.onend?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = cachedVoice ?? pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = opts.rate ?? 0.95;
  u.pitch = 1;
  if (opts.onend) u.onend = opts.onend;
  synth.speak(u);
}

export function stopSpeaking() {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}

/* ---------------- Speech-to-text ---------------- */

type RecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttAvailable(): boolean {
  return getRecognition() !== null;
}

export interface Recognizer {
  supported: boolean;
  start: () => void;
  stop: () => void;
}

export function createRecognizer(handlers: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError?: (err: string) => void;
}): Recognizer {
  const Ctor = getRecognition();
  if (!Ctor) return { supported: false, start: () => handlers.onEnd(), stop: () => undefined };
  let rec: ReturnType<RecognitionCtor["prototype"]["start"]> extends never ? never : InstanceType<RecognitionCtor> | null = null;
  return {
    supported: true,
    start: () => {
      try {
        rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = false;
        rec.interimResults = true;
        rec.onresult = (e) => {
          let transcript = "";
          let isFinal = false;
          for (let i = 0; i < e.results.length; i++) {
            transcript += e.results[i][0].transcript;
            if (e.results[i].isFinal) isFinal = true;
          }
          handlers.onResult(transcript.trim(), isFinal);
        };
        rec.onend = () => handlers.onEnd();
        rec.onerror = (e) => handlers.onError?.(e.error);
        rec.start();
      } catch {
        handlers.onEnd();
      }
    },
    stop: () => {
      try { rec?.stop(); } catch { /* noop */ }
    },
  };
}
