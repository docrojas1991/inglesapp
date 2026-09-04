import { useEffect, useMemo, useRef, useState } from "react";
import type { ExType, Phrase, PhraseProgress, PlannedItem, SessionConfig, SessionSummary, Verdict } from "../lib/types";
import { ACHIEVEMENTS, EX_LABELS } from "../lib/data";
import {
  bandRank, blankTarget, buildFeedback, evaluateFree, evaluateTyped, getState, masteryBand,
  nextReviewLabel, pickOptions, scrambleWords, tutorReview, xpFor,
} from "../lib/engine";
import { createRecognizer, speak, sttAvailable, stopSpeaking } from "../lib/audio";
import { useApp } from "../store";
import { Button, Card, Chip, Modal, ProgressBar, Ring, cx, useCountUp } from "../ui";
import {
  Check, ChevronRight, Ear, Keyboard, Mic, MicOff, Pause, Play, RotateCcw, Star, Volume2, X, Zap,
} from "lucide-react";

interface ItemResult { phraseId: string; ex: ExType; verdict: Verdict; xp: number }

export function PracticeScreen() {
  const { practice } = useApp();
  if (!practice) return null;
  const key = practice.title + "::" + practice.items.map((i) => i.phraseId + i.ex).join("|");
  return <Runner key={key} config={practice} />;
}

function Runner({ config }: { config: SessionConfig }) {
  const { phrases, data, recordExercise, recordSession, closePractice, toast, completeLesson, setModuleTest, startPractice, nav } = useApp();
  const [queue, setQueue] = useState<(PlannedItem & { requeues: number })[]>(() => config.items.map((i) => ({ ...i, requeues: 0 })));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"question" | "feedback" | "done">("question");
  const [results, setResults] = useState<ItemResult[]>([]);
  const [feedback, setFeedback] = useState<ReturnType<typeof buildFeedback> | null>(null);
  const [fbMeta, setFbMeta] = useState<{ phrase: Phrase; ex: ExType; delta: number; delayed: boolean } | null>(null);
  const [exitAsk, setExitAsk] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const startRef = useRef(Date.now());
  const snapshotRef = useRef<Record<string, PhraseProgress | undefined>>(data.progress);
  const choiceRef = useRef<((i: number) => void) | null>(null);
  const submitRef = useRef<(() => void) | null>(null);
  const pmap = useMemo(() => new Map(phrases.map((p) => [p.id, p])), [phrases]);

  const item = queue[idx];
  const phrase = item ? pmap.get(item.phraseId) : undefined;
  const total = queue.length;

  const finish = (finalResults: ItemResult[]) => {
    stopSpeaking();
    if (finalResults.length === 0) {
      closePractice();
      nav("dashboard");
      return;
    }
    const seconds = Math.round((Date.now() - startRef.current) / 1000);
    const correct = finalResults.filter((r) => r.verdict === "correct").length;
    const alt = finalResults.filter((r) => r.verdict === "alt").length;
    const incorrect = finalResults.filter((r) => r.verdict === "incorrect").length;
    const xp = finalResults.reduce((s, r) => s + r.xp, 0);
    const before = snapshotRef.current;
    const after = data.progress;
    const ids = [...new Set(finalResults.map((r) => r.phraseId))];
    const newLearned: string[] = [], strengthened: string[] = [], mastered: string[] = [], weakened: string[] = [];
    for (const id of ids) {
      const b = before[id];
      const a = after[id];
      if (!b || b.timesSeen === 0) newLearned.push(id);
      const br = bandRank(getState(b));
      const ar = bandRank(getState(a));
      if (ar > br) strengthened.push(id);
      if (ar < br) weakened.push(id);
      if ((a?.mastery ?? 0) >= 75 && (b?.mastery ?? 0) < 75) mastered.push(id);
    }
    const weakIds = [...new Set(finalResults.filter((r) => r.verdict === "incorrect").map((r) => r.phraseId))];
    const exercises = finalResults.length;
    const sum: SessionSummary = {
      exercises, correct, incorrect, alt,
      accuracy: exercises ? Math.round(((correct + alt) / exercises) * 100) : 0,
      xp, seconds, newLearned, strengthened, mastered, weakened, weakIds,
    };
    setSummary(sum);
    if (exercises > 0) {
      const un = recordSession(sum, config.mode, config.metaId);
      setUnlocked(un);
      if (config.mode === "lesson" && config.metaId) completeLesson(config.metaId);
      if (config.mode === "test" && config.metaId) {
        const m = Number(config.metaId.replace("test-", ""));
        setModuleTest(m, sum.accuracy, sum.accuracy >= 70);
      }
    }
    setPhase("done");
  };

  const submit = (verdict: Verdict) => {
    if (!item || !phrase) return;
    stopSpeaking();
    const { delta, delayedBonus } = recordExercise(phrase.id, item.ex, verdict);
    const fb = buildFeedback(verdict, phrase, currentInputRef.current, item.ex, undefined, tierRef.current);
    setFeedback(fb);
    setFbMeta({ phrase, ex: item.ex, delta, delayed: delayedBonus });
    setResults((r) => [...r, { phraseId: phrase.id, ex: item.ex, verdict, xp: xpFor(item.ex, verdict) }]);
    if (verdict === "incorrect" && item.requeues < 2) {
      const again: PlannedItem & { requeues: number } = { ...item, requeues: item.requeues + 1, ex: item.ex === "en_es" ? "fill" : "en_es" };
      setQueue((q) => {
        const nq = [...q];
        nq.splice(Math.min(nq.length, idx + 3 + Math.floor(Math.random() * 2)), 0, again);
        return nq;
      });
    }
    setPhase("feedback");
  };

  // channels for child exercises to report free-text input & tutor tier
  const currentInputRef = useRef("");
  const tierRef = useRef<number | undefined>(undefined);
  const reportInput = (s: string) => { currentInputRef.current = s; };
  const reportTier = (t: number | undefined) => { tierRef.current = t; };

  const next = () => {
    setFeedback(null);
    setFbMeta(null);
    currentInputRef.current = "";
    tierRef.current = undefined;
    if (idx + 1 >= queue.length) finish(resultsRef.current);
    else { setIdx((i) => i + 1); setPhase("question"); }
  };
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const queueLenRef = useRef(queue.length);
  queueLenRef.current = queue.length;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (phase === "feedback" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); return; }
      if (phase !== "question" || typing) return;
      if (e.key >= "1" && e.key <= "4") choiceRef.current?.(Number(e.key) - 1);
      if (e.key === "Enter") submitRef.current?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (phase === "done" && summary) {
    return <SummaryScreen summary={summary} config={config} unlocked={unlocked} weakIds={summary.weakIds} pmap={pmap}
      onClose={() => { closePractice(); nav("dashboard"); }}
      onWeak={() => {
        closePractice();
        startPractice({
          title: "Weak phrase repair", subtitle: "A short focused round", mode: "review",
          items: summary.weakIds.map((id) => ({ phraseId: id, ex: "es_en" as ExType, bucket: "scope" as const })),
        });
      }}
    />;
  }

  if (!item || !phrase) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper dark:bg-night">
      <div className="ambient" />
      <div className="relative z-10 mx-auto flex min-h-full max-w-2xl flex-col px-4 py-4 sm:py-8">
        {/* header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setExitAsk(true)}
            className="btn-press focus-ring rounded-xl border border-line bg-panel p-2 text-mute hover:text-clay-500 dark:border-nline dark:bg-carbon"
            aria-label="End session"
          >
            <X size={18} />
          </button>
          <div className="flex-1">
            <ProgressBar value={(idx / Math.max(1, total)) * 100} />
          </div>
          <span className="font-mono text-xs font-bold text-mute dark:text-faint">{idx + 1}<span className="opacity-50">/{total}</span></span>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">{config.title}</p>
            <p className="font-display text-xl font-bold sm:text-2xl">{EX_LABELS[item.ex]}</p>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={phrase.domain === "medical" ? "med" : "pine"}>{phrase.domain === "medical" ? "Medical" : "Everyday"}</Chip>
            {item.bucket === "overdue" && <Chip tone="clay">due</Chip>}
            {item.bucket === "new" && <Chip tone="gold">new</Chip>}
            {item.bucket === "weak" && <Chip tone="clay">weak</Chip>}
          </div>
        </div>

        <div key={`${idx}-${item.phraseId}-${item.ex}`} className="flex-1">
          <Exercise
            phrase={phrase}
            ex={item.ex}
            phrases={phrases}
            choiceRef={choiceRef}
            submitRef={submitRef}
            onSubmit={submit}
            reportInput={reportInput}
            reportTier={reportTier}
          />
        </div>

        {/* feedback sheet */}
        {phase === "feedback" && feedback && fbMeta && (
          <div className={cx(
            "anim-rise sticky bottom-0 mt-4 rounded-2xl border-2 p-5 shadow-pop",
            feedback.verdict === "incorrect"
              ? "border-clay-400/50 bg-clay-100/70 dark:border-clay-500/40 dark:bg-clay-500/10"
              : feedback.verdict === "alt"
                ? "border-gold-300 bg-gold-100/70 dark:border-gold-400/40 dark:bg-gold-400/10"
                : "border-pine-300 bg-pine-50 dark:border-pine-700 dark:bg-pine-900/40",
          )}>
            <div className="flex items-start gap-3">
              <div className={cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
                feedback.verdict === "incorrect" ? "bg-clay-500" : feedback.verdict === "alt" ? "bg-gold-500" : "bg-pine-600",
              )}>
                {feedback.verdict === "incorrect" ? <X size={18} /> : <Check size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">{feedback.headline}</p>
                {fbMeta.delayed && feedback.verdict !== "incorrect" && (
                  <Chip tone="gold" className="mb-1 mt-1"><Zap size={11} /> delayed-recall bonus</Chip>
                )}
                {feedback.lines.map((l, i) => (
                  <p key={i} className="mt-1 text-sm text-ink/85 dark:text-snow/85">{l}</p>
                ))}
                {feedback.tip && <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-xs font-medium text-pine-800 dark:bg-carbon/70 dark:text-pine-200">Pattern · {feedback.tip}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AudioBtn text={fbMeta.phrase.en} small />
                  <span className="text-sm font-semibold">“{fbMeta.phrase.en}” <span className="font-normal text-mute dark:text-faint">— {fbMeta.phrase.es}</span></span>
                  <span className={cx("ml-auto font-mono text-xs font-bold", fbMeta.delta >= 0 ? "text-pine-600 dark:text-pine-300" : "text-clay-500")}>
                    {fbMeta.delta >= 0 ? "+" : ""}{fbMeta.delta} mastery
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="hidden text-xs text-mute sm:block dark:text-faint">Press <kbd>Enter</kbd> to continue{feedback.verdict === "incorrect" ? " — this phrase will return in a few cards" : ""}</p>
              <Button onClick={next} className="ml-auto w-full sm:w-auto" size="lg">
                Continue <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal open={exitAsk} onClose={() => setExitAsk(false)}>
        <h3 className="font-display text-xl font-bold">End this session?</h3>
        <p className="mt-1 text-sm text-mute dark:text-faint">
          {results.length > 0 ? `${results.length} exercise${results.length === 1 ? "" : "s"} will be saved to your history.` : "Nothing will be saved yet."}
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setExitAsk(false)}>Keep going</Button>
          <Button variant="danger" className="flex-1" onClick={() => { setExitAsk(false); finish(resultsRef.current); }}>
            {results.length > 0 ? "Save & finish" : "End session"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- exercise renderers ---------------- */

function AudioBtn({ text, small, slow }: { text: string; small?: boolean; slow?: boolean }) {
  const { data } = useApp();
  const rate = slow ? 0.62 : data.settings.audioRate === "slow" ? 0.8 : 0.95;
  return (
    <button
      onClick={() => speak(text, { rate })}
      className={cx(
        "btn-press focus-ring inline-flex items-center justify-center rounded-xl bg-pine-600 text-white shadow-lift hover:bg-pine-700",
        small ? "h-8 w-8" : "h-12 w-12",
      )}
      aria-label={slow ? "Play slowly" : "Play audio"}
      title={slow ? "Slow speed" : "Play"}
    >
      {slow ? <Pause size={small ? 14 : 18} /> : <Volume2 size={small ? 14 : 20} />}
    </button>
  );
}

function EqBars() {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="eq-bar w-1 rounded-sm bg-pine-500" style={{ height: "100%", animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

interface ExProps {
  phrase: Phrase;
  ex: ExType;
  phrases: Phrase[];
  choiceRef: React.MutableRefObject<((i: number) => void) | null>;
  submitRef: React.MutableRefObject<(() => void) | null>;
  onSubmit: (v: Verdict) => void;
  reportInput: (s: string) => void;
  reportTier: (t: number | undefined) => void;
}

function Exercise(props: ExProps) {
  switch (props.ex) {
    case "en_es": return <ChoiceEx {...props} promptLabel="What does this mean?" showEn audio choicesKey="es" />;
    case "meaning": return <ListeningEx {...props} />;
    case "context": return <ContextChoiceEx {...props} />;
    case "listen": return <ListenTypeEx {...props} />;
    case "fill": return <FillEx {...props} />;
    case "rebuild": return <RebuildEx {...props} />;
    case "dictation": return <DictationEx {...props} />;
    case "es_en": return <TypeEnEx {...props} />;
    case "speaking": return <SpeakingEx {...props} />;
    case "context_gen": return <ContextGenEx {...props} />;
    default: return <ChoiceEx {...props} promptLabel="What does this mean?" showEn audio choicesKey="es" />;
  }
}

function PromptCard({ label, children, audio }: { label: string; children: React.ReactNode; audio?: React.ReactNode }) {
  return (
    <Card className="anim-pop p-6 sm:p-8">
      <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-widest text-faint">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        {audio}
      </div>
    </Card>
  );
}

function OptionList({ options, onPick, prefix = "en" }: { options: string[]; onPick: (i: number) => void; prefix?: string }) {
  const [hover, setHover] = useState(-1);
  return (
    <div className="stagger mt-4 grid gap-2">
      {options.map((o, i) => (
        <button
          key={i}
          onClick={() => onPick(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(-1)}
          className={cx(
            "btn-press focus-ring group flex items-center gap-3 rounded-xl border-2 border-line bg-panel px-4 py-3.5 text-left text-[15px] font-medium dark:border-nline dark:bg-carbon",
            hover === i && "border-pine-400 bg-pine-50 dark:border-pine-600 dark:bg-pine-900/30",
          )}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-paper font-mono text-[11px] font-bold text-mute group-hover:bg-pine-600 group-hover:text-white dark:bg-carbon2 dark:text-faint">
            {i + 1}
          </span>
          <span dir={prefix === "es" ? "auto" : undefined}>{o}</span>
        </button>
      ))}
    </div>
  );
}

function verdictFromType(expected: string, alts: string[], input: string, phrase: Phrase): Verdict {
  const tv = evaluateTyped(expected, alts, input);
  if (tv.verdict !== "incorrect") return tv.verdict;
  const free = evaluateFree(input, phrase.concepts);
  if (free.tier >= 2) return "alt";
  return "incorrect";
}

function ChoiceEx({ phrase, ex, phrases, choicesKey, showEn, audio, promptLabel, choiceRef, onSubmit }: ExProps & { choicesKey: "en" | "es"; showEn?: boolean; audio?: boolean; promptLabel: string }) {
  const pool = useMemo(() => {
    const sameDom = phrases.filter((p) => p.domain === phrase.domain);
    return sameDom.length >= 8 ? sameDom : phrases;
  }, [phrases, phrase]);
  const options = useMemo(() => pickOptions(phrase, pool, choicesKey), [phrase, pool, choicesKey]);
  useEffect(() => {
    choiceRef.current = (i) => { if (options[i]) resolve(i); };
    if (audio) speak(phrase.en, { rate: 0.95 });
    return () => { choiceRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resolve = (i: number) => onSubmit(options[i] === phrase[choicesKey] ? "correct" : "incorrect");
  return (
    <div>
      <PromptCard label={promptLabel} audio={audio ? <AudioBtn text={phrase.en} /> : undefined}>
        {showEn ? (
          <p className="font-display text-2xl font-bold leading-snug sm:text-3xl">“{phrase.en}”</p>
        ) : (
          <p className="font-display text-2xl font-bold leading-snug sm:text-3xl" dir="auto">{phrase.es}</p>
        )}
        {ex === "en_es" && <p className="mt-2 text-sm italic text-mute dark:text-faint">e.g. {phrase.example}</p>}
      </PromptCard>
      <OptionList options={options} onPick={resolve} prefix={choicesKey} />
    </div>
  );
}

function ContextChoiceEx({ phrase, phrases, choiceRef, onSubmit }: ExProps) {
  const pool = useMemo(() => {
    const sameMod = phrases.filter((p) => p.module === phrase.module);
    return sameMod.length >= 6 ? sameMod : phrases.filter((p) => p.domain === phrase.domain);
  }, [phrases, phrase]);
  const options = useMemo(() => pickOptions(phrase, pool, "en"), [phrase, pool]);
  useEffect(() => {
    choiceRef.current = (i) => { if (options[i]) resolve(i); };
    return () => { choiceRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resolve = (i: number) => onSubmit(options[i] === phrase.en ? "correct" : "incorrect");
  return (
    <div>
      <Card className="anim-pop p-6 sm:p-8">
        <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-widest text-faint">Situation</p>
        <p className="text-lg leading-relaxed text-ink dark:text-snow">{phrase.scenario}</p>
        <p className="mt-3 text-sm font-semibold text-pine-700 dark:text-pine-300">Which response sounds most natural?</p>
      </Card>
      <OptionList options={options} onPick={resolve} />
    </div>
  );
}

function ListeningEx({ phrase, phrases, choiceRef, onSubmit }: ExProps) {
  const [playing, setPlaying] = useState(false);
  const pool = useMemo(() => {
    const sameDom = phrases.filter((p) => p.domain === phrase.domain);
    return sameDom.length >= 8 ? sameDom : phrases;
  }, [phrases, phrase]);
  const options = useMemo(() => pickOptions(phrase, pool, "es"), [phrase, pool]);
  const play = () => {
    setPlaying(true);
    speak(phrase.en, { rate: 0.95, onend: () => setPlaying(false) });
  };
  useEffect(() => {
    choiceRef.current = (i) => { if (options[i]) resolve(i); };
    play();
    return () => { choiceRef.current = null; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resolve = (i: number) => onSubmit(options[i] === phrase.es ? "correct" : "incorrect");
  return (
    <div>
      <Card className="anim-pop p-6 text-center sm:p-10">
        <p className="mb-4 font-mono text-[11px] font-bold uppercase tracking-widest text-faint">Listen — what did you hear?</p>
        <button
          onClick={play}
          className={cx("btn-press focus-ring mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-pine-600 text-white shadow-pop hover:bg-pine-700", playing && "streak-live")}
          aria-label="Play audio"
        >
          {playing ? <EqBars /> : <Play size={30} className="ml-1" />}
        </button>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button onClick={() => speak(phrase.en, { rate: 0.62 })} className="btn-press focus-ring text-xs font-semibold text-mute underline-offset-2 hover:underline dark:text-faint">
            <Pause size={11} className="mr-1 inline" />slow speed
          </button>
        </div>
      </Card>
      <OptionList options={options} onPick={resolve} prefix="es" />
    </div>
  );
}

function TypeField({ onSubmit, placeholder, reportInput, value, setValue, mono }: {
  onSubmit: () => void; placeholder: string; reportInput: (s: string) => void;
  value: string; setValue: (s: string) => void; mono?: boolean;
}) {
  return (
    <div className="mt-4">
      <input
        autoFocus
        value={value}
        onChange={(e) => { setValue(e.target.value); reportInput(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        placeholder={placeholder}
        dir="auto"
        className={cx(
          "focus-ring w-full rounded-xl border-2 border-line bg-panel px-4 py-3.5 text-[15px] font-medium placeholder:text-faint/70 focus:border-pine-500 dark:border-nline dark:bg-carbon",
          mono && "font-mono",
        )}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-mute dark:text-faint"><kbd>Enter</kbd> to check</p>
        <Button onClick={onSubmit} disabled={!value.trim()} size="lg">Check</Button>
      </div>
    </div>
  );
}

function TypeEnEx({ phrase, submitRef, onSubmit, reportInput, reportTier }: ExProps) {
  const [value, setValue] = useState("");
  useEffect(() => {
    submitRef.current = doSubmit;
    return () => { submitRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const doSubmit = () => {
    if (!value.trim()) return;
    reportTier(undefined);
    onSubmit(verdictFromType(phrase.en, [], value, phrase));
  };
  return (
    <div>
      <PromptCard label="Say it in English" audio={<AudioBtn text={phrase.en} />}>
        <p className="font-display text-2xl font-bold leading-snug sm:text-3xl" dir="auto">{phrase.es}</p>
        <p className="mt-2 text-sm text-mute dark:text-faint">also: <em>{phrase.alt}</em></p>
        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-mute dark:bg-night dark:text-faint">Situation · {phrase.scenario}</p>
      </PromptCard>
      <TypeField value={value} setValue={setValue} reportInput={reportInput} onSubmit={doSubmit} placeholder="Type the English phrase…" />
    </div>
  );
}

function FillEx({ phrase, submitRef, onSubmit, reportInput }: ExProps) {
  const { prompt, answer } = useMemo(() => blankTarget(phrase), [phrase]);
  const [value, setValue] = useState("");
  useEffect(() => {
    submitRef.current = doSubmit;
    return () => { submitRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const doSubmit = () => {
    if (!value.trim()) return;
    const ok = value.trim().toLowerCase().replace(/[^a-z']/g, "") === answer.replace(/[^a-z']/g, "");
    onSubmit(ok ? "correct" : "incorrect");
  };
  return (
    <div>
      <PromptCard label="Fill in the blank" audio={<AudioBtn text={phrase.en} />}>
        <p className="font-display text-2xl font-bold leading-snug sm:text-3xl">
          {prompt.split("_____").map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className="mx-1 inline-block min-w-16 border-b-4 border-pine-400 px-1 text-center text-pine-600 dark:text-pine-300">{value || " "}</span>
              )}
            </span>
          ))}
        </p>
        <p className="mt-2 text-sm text-mute dark:text-faint" dir="auto">Meaning: {phrase.es}</p>
      </PromptCard>
      <TypeField value={value} setValue={setValue} reportInput={reportInput} onSubmit={doSubmit} placeholder="Type the missing word…" mono />
    </div>
  );
}

function RebuildEx({ phrase, phrases, onSubmit }: ExProps) {
  const { chips, answer } = useMemo(() => {
    const others = phrases.filter((p) => p.id !== phrase.id && p.domain === phrase.domain);
    const decoys = others.sort(() => Math.random() - 0.5).slice(0, 4).map((p) => p.en.split(" ")[0]);
    return scrambleWords(phrase, decoys);
  }, [phrase, phrases]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done && placed.length === chips.length) {
      setDone(true);
      const guess = placed.map((i) => chips[i].replace(/[.,!?]/g, "").toLowerCase()).join(" ");
      const target = answer.map((w) => w.replace(/[.,!?]/g, "").toLowerCase()).join(" ");
      setTimeout(() => onSubmit(guess === target ? "correct" : "incorrect"), 350);
    }
  }, [placed, chips, answer, done, onSubmit]);
  return (
    <div>
      <PromptCard label="Rebuild the sentence" audio={<AudioBtn text={phrase.en} />}>
        <p className="text-sm text-mute dark:text-faint" dir="auto">{phrase.es}</p>
        <div className="mt-3 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-line bg-paper/60 p-3 dark:border-nline dark:bg-night/50">
          {placed.length === 0 && <span className="text-sm text-faint">Tap the words in order…</span>}
          {placed.map((ci, i) => (
            <button key={`${ci}-${i}`} onClick={() => setPlaced((p) => p.filter((_, j) => j !== i))}
              className="anim-pop btn-press focus-ring rounded-lg bg-pine-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-pine-700">
              {chips[ci]}
            </button>
          ))}
        </div>
      </PromptCard>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((c, i) => {
          const used = placed.includes(i);
          return (
            <button key={i} disabled={used}
              onClick={() => setPlaced((p) => [...p, i])}
              className={cx(
                "btn-press focus-ring rounded-lg border-2 border-line bg-panel px-3.5 py-2 text-sm font-semibold shadow-sm dark:border-nline dark:bg-carbon",
                used ? "opacity-25" : "hover:-translate-y-0.5 hover:border-pine-400 hover:text-pine-700 dark:hover:text-pine-300",
              )}>
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DictationEx({ phrase, submitRef, onSubmit, reportInput }: ExProps) {
  const [value, setValue] = useState("");
  const [plays, setPlays] = useState(0);
  useEffect(() => {
    speak(phrase.en, { rate: 0.95 });
    setPlays((p) => p + 1);
    submitRef.current = doSubmit;
    return () => { submitRef.current = null; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const doSubmit = () => {
    if (!value.trim()) return;
    onSubmit(verdictFromType(phrase.en, [], value, phrase));
  };
  return (
    <div>
      <Card className="anim-pop p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-faint">Dictation — write exactly what you hear</p>
            <p className="mt-2 text-sm text-mute dark:text-faint" dir="auto">Hint · meaning: {phrase.es}</p>
          </div>
          <div className="flex items-center gap-2">
            <AudioBtn text={phrase.en} />
            <AudioBtn text={phrase.en} slow />
          </div>
        </div>
      </Card>
      <TypeField value={value} setValue={setValue} reportInput={reportInput} onSubmit={doSubmit} placeholder="Type what you heard…" />
      {plays > 0 && <p className="mt-2 text-right text-xs text-faint">plays: {plays}</p>}
    </div>
  );
}

function ListenTypeEx({ phrase, submitRef, onSubmit, reportInput }: ExProps) {
  const [value, setValue] = useState("");
  useEffect(() => {
    speak(phrase.en, { rate: 0.95 });
    submitRef.current = doSubmit;
    return () => { submitRef.current = null; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const doSubmit = () => {
    if (!value.trim()) return;
    onSubmit(verdictFromType(phrase.es, [phrase.alt], value, phrase));
  };
  return (
    <div>
      <Card className="anim-pop p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-faint">Listen — write the meaning in Spanish</p>
            <p className="mt-2 text-sm text-mute dark:text-faint">Focus on the idea, not word-for-word.</p>
          </div>
          <div className="flex items-center gap-2">
            <AudioBtn text={phrase.en} />
            <AudioBtn text={phrase.en} slow />
          </div>
        </div>
      </Card>
      <TypeField value={value} setValue={setValue} reportInput={reportInput} onSubmit={doSubmit} placeholder="¿Qué significa?…" />
    </div>
  );
}

function SpeakingEx({ phrase, submitRef, onSubmit, reportInput, reportTier }: ExProps) {
  const supported = sttAvailable();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [mode, setMode] = useState<"mic" | "self">(supported ? "mic" : "self");
  useEffect(() => {
    submitRef.current = doSubmit;
    return () => { submitRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);
  const recRef = useRef<ReturnType<typeof createRecognizer> | null>(null);
  const startMic = () => {
    setTranscript("");
    setListening(true);
    recRef.current = createRecognizer({
      onResult: (t, isFinal) => { setTranscript(t); if (isFinal) setListening(false); },
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    recRef.current.start();
  };
  const doSubmit = () => {
    if (!transcript.trim()) return;
    reportTier(undefined);
    onSubmit(verdictFromType(phrase.en, [], transcript, phrase));
  };
  const selfRate = (v: Verdict) => { reportInput("(self-assessed)"); reportTier(undefined); onSubmit(v); };
  return (
    <div>
      <PromptCard label="Say it out loud" audio={<AudioBtn text={phrase.en} />}>
        <p className="text-sm text-mute dark:text-faint" dir="auto">Say in English: <strong className="text-ink dark:text-snow">{phrase.es}</strong></p>
        <p className="mt-1 text-xs text-faint">Listen first, then shadow it. Accents are fine — we check the words.</p>
      </PromptCard>

      {mode === "mic" && supported && (
        <Card className="anim-rise mt-4 p-6 text-center">
          <button
            onClick={listening ? () => recRef.current?.stop() : startMic}
            className={cx(
              "btn-press focus-ring mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-pop",
              listening ? "streak-live bg-clay-500" : "bg-pine-600 hover:bg-pine-700",
            )}
            aria-label="Record your voice"
          >
            {listening ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <p className="mt-3 min-h-5 text-sm font-medium text-mute dark:text-faint">
            {listening ? "Listening… speak now" : transcript ? `I heard: “${transcript}”` : "Tap the mic and say the phrase"}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={doSubmit} disabled={!transcript.trim() || listening}>Check my answer</Button>
            <Button variant="ghost" size="md" onClick={() => setMode("self")}><Keyboard size={14} /> no mic? rate yourself</Button>
          </div>
        </Card>
      )}

      {mode === "self" && (
        <Card className="anim-rise mt-4 p-6">
          <p className="text-sm font-semibold">How did it go?</p>
          <p className="mt-1 text-xs text-mute dark:text-faint">Listen to the phrase, say it out loud, then be honest with yourself.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => selfRate("incorrect")}>Couldn't say it</Button>
            <Button variant="outline" onClick={() => selfRate("alt")}>Almost there</Button>
            <Button onClick={() => selfRate("correct")}>Nailed it</Button>
          </div>
          {supported && <button onClick={() => setMode("mic")} className="btn-press mt-3 text-xs font-semibold text-pine-600 underline-offset-2 hover:underline dark:text-pine-300">Use the microphone instead</button>}
        </Card>
      )}
    </div>
  );
}

function ContextGenEx({ phrase, submitRef, onSubmit, reportInput, reportTier }: ExProps) {
  const [value, setValue] = useState("");
  useEffect(() => {
    submitRef.current = doSubmit;
    return () => { submitRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const doSubmit = () => {
    if (!value.trim()) return;
    const { tier } = evaluateFree(value, phrase.concepts);
    reportTier(tier);
    const v: Verdict = tier >= 2 ? "correct" : tier === 1 ? "alt" : "incorrect";
    onSubmit(v);
  };
  return (
    <div>
      <Card className="anim-pop p-6 sm:p-8">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-faint">Respond naturally</p>
        <p className="mt-3 text-lg leading-relaxed">{phrase.scenario}</p>
        <p className="mt-3 text-sm text-mute dark:text-faint">
          Aim for the idea behind: <strong className="text-ink dark:text-snow">{phrase.es}</strong>
        </p>
      </Card>
      <div className="mt-4">
        <textarea
          autoFocus
          rows={3}
          value={value}
          onChange={(e) => { setValue(e.target.value); reportInput(e.target.value); }}
          placeholder="Type your natural English response…"
          className="focus-ring w-full resize-none rounded-xl border-2 border-line bg-panel px-4 py-3.5 text-[15px] font-medium placeholder:text-faint/70 focus:border-pine-500 dark:border-nline dark:bg-carbon"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-mute dark:text-faint">The tutor checks meaning, not exact words</p>
          <Button onClick={doSubmit} disabled={!value.trim()} size="lg">Check</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- summary ---------------- */

function SummaryScreen({ summary, config, unlocked, weakIds, pmap, onClose, onWeak }: {
  summary: SessionSummary; config: SessionConfig; unlocked: string[]; weakIds: string[];
  pmap: Map<string, Phrase>; onClose: () => void; onWeak: () => void;
}) {
  const acc = useCountUp(summary.accuracy);
  const xp = useCountUp(summary.xp);
  const name = (id: string) => pmap.get(id)?.en ?? id;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper dark:bg-night">
      <div className="ambient" />
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:py-14">
        <div className="anim-pop text-center">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">{config.title} · complete</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {summary.accuracy >= 85 ? "Outstanding work." : summary.accuracy >= 65 ? "Solid session." : "Good reps — keep at it."}
          </h1>
          <p className="mt-2 text-mute dark:text-faint">
            {summary.exercises} exercises · {Math.max(1, Math.round(summary.seconds / 60))} min studied
          </p>
        </div>

        <div className="stagger mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4 text-center">
            <Ring value={acc} size={64} label={<span className="font-display text-base font-extrabold">{acc}%</span>} sub="accuracy" />
          </Card>
          <Card className="flex flex-col items-center justify-center p-4">
            <span className="flex items-center gap-1 font-display text-3xl font-extrabold text-gold-500"><Zap size={22} />{xp}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-faint">XP earned</span>
          </Card>
          <Card className="flex flex-col items-center justify-center p-4">
            <span className="font-display text-3xl font-extrabold text-pine-600 dark:text-pine-300">{summary.newLearned.length}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-faint">new phrases</span>
          </Card>
          <Card className="flex flex-col items-center justify-center p-4">
            <span className="font-display text-3xl font-extrabold">{summary.strengthened.length}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-faint">strengthened</span>
          </Card>
        </div>

        {summary.mastered.length > 0 && (
          <Card className="anim-rise mt-4 border-pine-300 bg-pine-50 p-5 dark:border-pine-800 dark:bg-pine-900/40">
            <p className="flex items-center gap-2 font-display text-lg font-bold text-pine-800 dark:text-pine-200">
              <Star size={18} className="text-gold-500" /> {summary.mastered.length} phrase{summary.mastered.length === 1 ? "" : "s"} reached Mastered
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.mastered.map((id) => <Chip key={id} tone="pine">{name(id)}</Chip>)}
            </div>
          </Card>
        )}

        {weakIds.length > 0 && (
          <Card className="anim-rise mt-4 p-5">
            <p className="flex items-center gap-2 font-display text-lg font-bold">
              <RotateCcw size={16} className="text-clay-500" /> {weakIds.length} need another round
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {weakIds.map((id) => <Chip key={id} tone="clay">{name(id)}</Chip>)}
            </div>
            <p className="mt-3 text-sm text-mute dark:text-faint">They'll resurface automatically — or knock them out now.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={onWeak}><Ear size={14} /> Practice weak phrases now</Button>
              <Button size="sm" variant="outline" onClick={onClose}>Later — back to dashboard</Button>
            </div>
          </Card>
        )}

        {unlocked.length > 0 && (
          <Card className="anim-rise mt-4 border-gold-300 bg-gold-100/60 p-5 dark:border-gold-400/30 dark:bg-gold-400/10">
            <p className="font-display text-lg font-bold text-gold-600">Achievement unlocked</p>
            <p className="text-sm text-ink/80 dark:text-snow/80">
              {unlocked.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title ?? id).join(" · ")}
            </p>
          </Card>
        )}

        <Card className="anim-rise mt-4 p-5">
          <p className="text-sm font-semibold">What happens next</p>
          <p className="mt-1 text-sm text-mute dark:text-faint">
            The scheduler placed today's phrases on their review ladder. Expect the fresh ones within a day,
            the strong ones in 3–7 days, and anything you missed tomorrow or sooner — interleaved, never back-to-back.
          </p>
        </Card>

        <div className="mt-6 flex justify-center">
          <Button size="lg" onClick={onClose}>Back to dashboard <ChevronRight size={16} /></Button>
        </div>
      </div>
    </div>
  );
}


