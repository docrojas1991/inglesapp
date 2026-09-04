import { useEffect, useMemo, useRef, useState } from "react";
import type { PlannedItem } from "../lib/types";
import { useApp } from "../store";
import { buildReviewPlan, getState, moduleUnlocked, scorePronunciation } from "../lib/engine";
import type { PronResult } from "../lib/engine";
import { createRecognizer, speak, sttAvailable, stopSpeaking } from "../lib/audio";
import { Button, Card, Chip, ProgressBar, Ring, StateChip, cx } from "../ui";
import {
  Ear, Flame, Lock, Mic, MicOff, Play, RotateCcw, Sparkles, Volume2,
} from "lucide-react";

export function StreetScreen() {
  const { phrases, data, startPractice, toast, nav } = useApp();
  const street = useMemo(() => phrases.filter((p) => p.domain === "street"), [phrases]);
  const unlocked = moduleUnlocked(11, data, phrases);

  const learned = street.filter((p) => (data.progress[p.id]?.timesSeen ?? 0) > 0).length;
  const strong = street.filter((p) => (data.progress[p.id]?.mastery ?? 0) >= 60).length;

  const train = () => {
    if (!unlocked) { toast("Primero completa el Módulo 1 para desbloquear la calle.", "gold"); nav("modules"); return; }
    const seenIds = street.filter((p) => (data.progress[p.id]?.timesSeen ?? 0) > 0).map((p) => p.id);
    const review = buildReviewPlan(seenIds, phrases, data.progress, data.settings);
    const fresh: PlannedItem[] = street
      .filter((p) => !seenIds.includes(p.id))
      .slice(0, 6)
      .map((p) => ({ phraseId: p.id, ex: "en_es" as const, bucket: "new" as const }));
    const items = [...review, ...fresh].slice(0, 22);
    if (!items.length) { toast("No hay frases callejeras disponibles.", "clay"); return; }
    startPractice({
      title: "Inglés callejero",
      subtitle: `${items.length} exercises · street talk & slang`,
      mode: "review",
      items,
    });
  };

  const listenDrill = () => {
    if (!unlocked) { toast("Primero completa el Módulo 1 para desbloquear la calle.", "gold"); nav("modules"); return; }
    const items: PlannedItem[] = street.slice(0, 12).map((p, i) => ({
      phraseId: p.id, ex: (i % 2 ? "listen" : "meaning") as PlannedItem["ex"], bucket: "scope",
    }));
    startPractice({ title: "Calle · modo escucha", subtitle: "Oído antes que ojos", mode: "review", items });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      {/* street-identity header */}
      <div className="anim-rise overflow-hidden rounded-3xl border border-clay-400/40 bg-carbon text-snow shadow-pop dark:border-clay-500/30">
        <div className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-clay-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-gold-300">
                <Flame size={13} /> Módulo 11 · Street talk &amp; slang
              </p>
              <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                Inglés de la <span className="text-gold-300">calle</span>.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-snow/70">
                El inglés que no sale en los libros: slang americano real, dicho como lo dicen los nativos.
                Escucha, repite y deja que el laboratorio de pronunciación te evalúe palabra por palabra.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={train} className="!bg-gold-400 !text-ink hover:!bg-gold-300">
                  <Play size={15} /> Entrenar calle
                </Button>
                <Button variant="outline" onClick={listenDrill} className="!border-snow/25 !text-snow hover:!bg-snow/10">
                  <Ear size={15} /> Modo escucha
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Frases" value={street.length} />
              <StatBox label="Aprendidas" value={learned} />
              <StatBox label="Sólidas" value={strong} accent="gold" />
              <StatBox label="Evals. pron." value={data.pronCount ?? 0} accent="gold" />
            </div>
          </div>
        </div>
      </div>

      {!unlocked && (
        <Card className="anim-rise mt-5 flex items-center gap-3 border-gold-300 bg-gold-100/60 p-4 dark:border-gold-400/30 dark:bg-gold-400/10">
          <Lock size={18} className="shrink-0 text-gold-600 dark:text-gold-300" />
          <p className="text-sm text-ink/80 dark:text-snow/80">
            La calle se desbloquea cuando dominas los fundamentos: termina de ver el <strong>Módulo 1</strong> (o aprueba su examen).
          </p>
        </Card>
      )}

      <PronunciationLab streetIds={street.map((p) => p.id)} />

      <p className="anim-rise mt-8 text-xs font-bold uppercase tracking-widest text-faint">Diccionario callejero</p>
      <div className="stagger mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {street.map((p) => {
          const pr = data.progress[p.id];
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <StateChip state={getState(pr)} />
                <Chip tone="gold" className="!px-2 !text-[10px]">{p.subcategory}</Chip>
              </div>
              <p className="mt-2.5 font-display text-xl font-bold leading-snug">{p.en}</p>
              <p className="mt-0.5 text-sm text-mute dark:text-faint" dir="auto">{p.es}</p>
              <p className="mt-2 text-xs leading-relaxed text-mute dark:text-faint">{p.explain}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => speak(p.en, { rate: 0.95 })}
                  className="btn-press focus-ring flex h-8 w-8 items-center justify-center rounded-lg bg-gold-100 text-gold-600 hover:bg-gold-300/50 dark:bg-gold-400/15 dark:text-gold-300"
                  aria-label="Reproducir"
                >
                  <Volume2 size={14} />
                </button>
                <button
                  onClick={() => speak(p.en, { rate: 0.6 })}
                  className="btn-press focus-ring flex h-8 items-center justify-center rounded-lg px-2 font-mono text-[10px] font-bold text-gold-600 hover:bg-gold-100 dark:text-gold-300 dark:hover:bg-gold-400/10"
                  aria-label="Reproducir lento"
                >
                  0.6×
                </button>
                <ProgressBar value={pr?.mastery ?? 0} className="h-1.5 flex-1" tone="gold" />
                <span className="font-mono text-[10px] font-bold text-faint">{Math.round(pr?.mastery ?? 0)}%</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent?: "gold" }) {
  return (
    <div className="min-w-24 rounded-2xl border border-snow/15 bg-snow/5 px-4 py-3">
      <p className={cx("font-display text-2xl font-extrabold", accent ? "text-gold-300" : "text-snow")}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-snow/50">{label}</p>
    </div>
  );
}

/* ================= Pronunciation lab ================= */

function PronunciationLab({ streetIds }: { streetIds: string[] }) {
  const { phrases, data, recordPron } = useApp();
  const [phraseId, setPhraseId] = useState<string>(streetIds[0] ?? "");
  const [stage, setStage] = useState<"idle" | "recording" | "result">("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<PronResult | null>(null);
  const [selfGraded, setSelfGraded] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const supported = sttAvailable();
  const phrase = phrases.find((p) => p.id === phraseId) ?? phrases.find((p) => p.domain === "street");

  useEffect(() => () => stopSpeaking(), []);

  const evaluate = (text: string, self?: number) => {
    if (!phrase) return;
    if (self !== undefined) {
      setResult({ score: self, words: [] });
      setSelfGraded(true);
    } else {
      setResult(scorePronunciation(text, phrase.en));
      setSelfGraded(false);
    }
    setStage("result");
    recordPron();
  };

  const record = () => {
    if (!phrase) return;
    setTranscript("");
    setResult(null);
    setStage("recording");
    speak(phrase.en, {
      rate: 0.9,
      onend: () => {
        if (!supported) return;
        const rec = createRecognizer({
          onResult: (t, fin) => { setTranscript(t); if (fin) evaluate(t); },
          onEnd: () => setStage((s) => (s === "recording" ? "idle" : s)),
          onError: () => setStage("idle"),
        });
        stopRef.current = rec.stop;
        rec.start();
      },
    });
  };

  const reset = () => { stopRef.current?.(); setStage("idle"); setTranscript(""); setResult(null); };

  const msg = result
    ? result.score >= 85 ? { t: "¡Muy natural!", b: "Un nativo te entendería sin esfuerzo. Sigue con otra frase.", tone: "pine" as const }
      : result.score >= 65 ? { t: "Natural — se entiende perfecto", b: "Pule las palabras marcadas en rojo y vuelve a intentarlo.", tone: "pine" as const }
      : result.score >= 40 ? { t: "Casi", b: "Repite con el audio lento (0.6×) enfocándote en las palabras que faltaron.", tone: "gold" as const }
        : { t: "Sigue el ritmo", b: "Escucha lento, repite palabra por palabra y luego la frase completa.", tone: "clay" as const }
    : null;

  return (
    <Card className="anim-rise mt-8 overflow-hidden">
      <div className="grid lg:grid-cols-[1.1fr_1fr]">
        {/* left: explanation + phrase pick */}
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r dark:border-nline">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-clay-500">
            <Mic size={14} /> Laboratorio de pronunciación
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Escucha. Repite. Te evalúo.</h2>
          <p className="mt-2 text-sm leading-relaxed text-mute dark:text-faint">
            {supported
              ? "Activa el micrófono y repite la frase: alinio tu voz con el objetivo palabra por palabra. El acento no se castiga — solo las palabras que se pierden."
              : "Tu navegador no permite transcripción de voz, así que el modo es autodidacta: escucha, repite en voz alta y califícate con honestidad."}
          </p>
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Frase objetivo</p>
            <select
              value={phrase?.id ?? ""}
              onChange={(e) => { setPhraseId(e.target.value); reset(); }}
              className="focus-ring mt-1.5 w-full rounded-xl border-2 border-line bg-panel px-3 py-2.5 text-sm font-semibold focus:border-gold-400 dark:border-nline dark:bg-carbon"
            >
              {phrases.filter((p) => p.domain === "street").map((p) => (
                <option key={p.id} value={p.id}>{p.en} — {p.es}</option>
              ))}
            </select>
          </div>
          {phrase?.pron && <p className="mt-3 font-mono text-xs text-faint">/{phrase.pron}/</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => phrase && speak(phrase.en, { rate: 0.95 })}><Volume2 size={13} /> Normal</Button>
            <Button size="sm" variant="outline" onClick={() => phrase && speak(phrase.en, { rate: 0.6 })}><Volume2 size={13} /> Lento 0.6×</Button>
          </div>
          <p className="mt-4 text-xs text-faint">{data.pronCount ?? 0} evaluaciones completadas · el logro “Oído y voz” te espera en la primera.</p>
        </div>

        {/* right: the lab itself */}
        <div className="bg-paper/60 p-6 dark:bg-night/40">
          {!phrase ? (
            <p className="text-sm text-faint">Agrega frases callejeras para usar el laboratorio.</p>
          ) : (
            <>
              <p className="font-display text-2xl font-extrabold leading-snug">“{phrase.en}”</p>

              {stage === "idle" && (
                <div className="mt-5">
                  <button
                    onClick={record}
                    className="btn-press focus-ring flex w-full items-center justify-center gap-3 rounded-2xl bg-clay-500 py-4 text-white shadow-lift hover:bg-clay-600"
                  >
                    <Mic size={20} /> {supported ? "Reproducir y grabarme" : "Reproducir (modo autodidacta)"}
                  </button>
                  <p className="mt-2 text-center text-xs text-faint">Suena la frase → cuando termina, repites en voz alta.</p>
                </div>
              )}

              {stage === "recording" && (
                <div className="mt-5">
                  <div className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-clay-400/60 bg-clay-100/60 py-5 dark:bg-clay-500/10">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className="eq-bar h-6 w-1.5 rounded-full bg-clay-500" style={{ animationDelay: `${i * 0.12}s` }} />
                    ))}
                    <span className="ml-3 text-sm font-bold text-clay-600 dark:text-clay-400">
                      {supported ? "Te escucho…" : "Repite en voz alta…"}
                    </span>
                  </div>
                  {supported && <p className="mt-2 min-h-5 text-center text-sm text-mute dark:text-faint">{transcript || "…"}</p>}
                  {!supported && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button size="sm" variant="outline" onClick={() => evaluate("", 90)}>La dije bien</Button>
                      <Button size="sm" variant="outline" onClick={() => evaluate("", 60)}>Casi</Button>
                      <Button size="sm" variant="outline" onClick={() => evaluate("", 35)}>Me costó</Button>
                    </div>
                  )}
                </div>
              )}

              {stage === "result" && result && msg && (
                <div className="anim-pop mt-5">
                  <div className="flex items-center gap-4">
                    <Ring value={result.score} size={74} stroke={7} tone={result.score >= 65 ? "pine" : result.score >= 40 ? "gold" : "clay"}
                      label={<span className="font-display text-base font-extrabold">{result.score}</span>} />
                    <div>
                      <p className={cx("font-display text-lg font-extrabold",
                        msg.tone === "pine" ? "text-pine-700 dark:text-pine-300" : msg.tone === "gold" ? "text-gold-600 dark:text-gold-300" : "text-clay-600 dark:text-clay-400")}>
                        {msg.t}
                      </p>
                      <p className="text-xs text-mute dark:text-faint">{msg.b}</p>
                    </div>
                  </div>

                  {!selfGraded && result.words.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {result.words.map((w, i) => (
                        <span key={i} className={cx("rounded-lg px-2.5 py-1 text-sm font-semibold",
                          w.hit ? "bg-pine-100 text-pine-800 dark:bg-pine-900/60 dark:text-pine-200"
                            : "bg-clay-100 text-clay-600 line-through decoration-clay-400 dark:bg-clay-500/15 dark:text-clay-400")}>
                          {w.word}
                        </span>
                      ))}
                    </div>
                  )}
                  {transcript && !selfGraded && (
                    <p className="mt-3 text-xs text-faint">Escuché: “{transcript}”</p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={record}><RotateCcw size={13} /> Intentar de nuevo</Button>
                    <Button size="sm" variant="outline" onClick={() => phrase && speak(phrase.en, { rate: 0.6 })}>
                      <Volume2 size={13} /> Audio lento
                    </Button>
                  </div>
                </div>
              )}

              {!supported && stage === "idle" && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-faint"><MicOff size={11} /> Chrome/Edge habilitan la transcripción automática.</p>
              )}
              <p className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-gold-600 dark:text-gold-300">
                <Sparkles size={11} /> Consejo: une las palabras — “hit me up” suena /hit-mi-up/, no palabra por palabra.
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
