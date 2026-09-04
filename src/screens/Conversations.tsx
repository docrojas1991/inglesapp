import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationScenario, SessionSummary, Verdict } from "../lib/types";
import { CONVERSATIONS } from "../lib/data";
import { evaluateFree } from "../lib/engine";
import { useApp } from "../store";
import { speak } from "../lib/audio";
import { Button, Card, Chip, ProgressBar, cx } from "../ui";
import { ArrowLeft, Check, Mic, MicOff, MessagesSquare, Play, RotateCcw, Star, Volume2 } from "lucide-react";
import { createRecognizer, sttAvailable } from "../lib/audio";

interface Bubble {
  who: "partner" | "user" | "tutor";
  text: string;
  tier?: number;
  model?: string;
}

const TIER_LABEL = ["Incorrect", "Understandable, but unnatural", "Natural", "Very natural"];
const TIER_XP = [2, 6, 10, 14];

export function Conversations() {
  const { data } = useApp();
  const [active, setActive] = useState<ConversationScenario | null>(null);
  if (active) return <Runner scenario={active} onBack={() => setActive(null)} />;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <div className="anim-rise">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Conversation mode</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Real dialogues. Real pressure. Real English.</h1>
        <p className="mt-1 max-w-2xl text-sm text-mute dark:text-faint">
          You play your role; the tutor grades each reply on meaning and naturalness — not exact wording. Difficulty ramps from front-desk small talk to lab phone calls.
        </p>
      </div>

      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2">
        {CONVERSATIONS.map((c) => {
          const best = data.conversationBest[c.id];
          return (
            <Card key={c.id} className="group p-5" onClick={() => setActive(c)}>
              <div className="flex items-center justify-between">
                <Chip tone={c.domain === "medical" ? "med" : "pine"}>{c.domain}</Chip>
                <span className="flex gap-0.5">
                  {[1, 2, 3].map((d) => (
                    <span key={d} className={cx("h-1.5 w-4 rounded-full", d <= c.difficulty ? (c.domain === "medical" ? "bg-med-500" : "bg-pine-500") : "bg-line dark:bg-nline")} />
                  ))}
                </span>
              </div>
              <h2 className="mt-3 font-display text-xl font-bold group-hover:text-pine-700 dark:group-hover:text-pine-300">{c.title}</h2>
              <p className="mt-1 text-sm text-mute dark:text-faint">{c.setting}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-faint">
                <span>You: {c.role}</span>
                {best !== undefined ? (
                  <span className="flex items-center gap-1 font-bold text-gold-600 dark:text-gold-300"><Star size={12} fill="currentColor" /> best {best}%</span>
                ) : (
                  <span className="font-semibold text-pine-600 group-hover:underline dark:text-pine-300">Start dialogue →</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Runner({ scenario, onBack }: { scenario: ConversationScenario; onBack: () => void }) {
  const { conversationScore, recordSession, toast } = useApp();
  const userTurns = useMemo(() => scenario.turns.filter((t) => t.speaker === "user"), [scenario]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const [tiers, setTiers] = useState<number[]>([]);
  const [listening, setListening] = useState(false);
  const startRef = useRef(Date.now());
  const supported = sttAvailable();
  const recRef = useRef<ReturnType<typeof createRecognizer> | null>(null);
  const resultsRef = useRef<number[]>([]);
  resultsRef.current = tiers;

  const cur = scenario.turns[step];

  // advance partner lines automatically
  useEffect(() => {
    if (done) return;
    if (cur?.speaker === "partner") {
      setTyping(true);
      const t = setTimeout(() => {
        setBubbles((b) => [...b, { who: "partner", text: cur.text ?? "" }]);
        speak(cur.text ?? "", { rate: 0.95 });
        setTyping(false);
        setStep((s) => s + 1);
      }, 800);
      return () => clearTimeout(t);
    }
    if (step >= scenario.turns.length) {
      setDone(true);
      finalize(resultsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done]);

  const finalize = (finalTiers: number[]) => {
    const score = Math.round((finalTiers.reduce((s, t) => s + t, 0) / Math.max(1, finalTiers.length * 3)) * 100);
    const xp = finalTiers.reduce((s, t) => s + TIER_XP[t], 0);
    const correct = finalTiers.filter((t) => t >= 2).length;
    const alt = finalTiers.filter((t) => t === 1).length;
    const incorrect = finalTiers.filter((t) => t === 0).length;
    const seconds = Math.round((Date.now() - startRef.current) / 1000);
    const summary: SessionSummary = {
      exercises: finalTiers.length, correct, incorrect, alt,
      accuracy: Math.round(((correct + alt) / Math.max(1, finalTiers.length)) * 100),
      xp, seconds, newLearned: [], strengthened: [], mastered: [], weakened: [], weakIds: [],
    };
    conversationScore(scenario.id, score);
    const un = recordSession(summary, "conversation");
    if (un.length) toast(`Achievement unlocked: ${un.join(", ")}`, "gold");
    setBubbles((b) => [...b, { who: "tutor", text: `Dialogue complete — score ${score}%, +${xp} XP. ${score >= 80 ? "That sounded like a working professional." : score >= 50 ? "Solid — replay it once more and it'll stick." : "Tough one — review the model answers and try again."}` }]);
  };

  const submit = () => {
    if (!cur || cur.speaker !== "user" || !input.trim()) return;
    const { tier } = evaluateFree(input, cur.concepts);
    const text = input.trim();
    setInput("");
    setTiers((t) => [...t, tier]);
    setBubbles((b) => {
      const nb: Bubble[] = [...b, { who: "user", text, tier }];
      if (tier < 3) nb.push({ who: "tutor", text: `${TIER_LABEL[tier]}. ${tier < 2 ? "A natural reply: " : "Even closer to native: "}“${cur.model}”${cur.tip ? ` — ${cur.tip}` : ""}`, tier });
      return nb;
    });
    setStep((s) => s + 1);
  };

  const startMic = () => {
    setListening(true);
    recRef.current = createRecognizer({
      onResult: (t, fin) => { setInput(t); if (fin) setListening(false); },
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
    recRef.current.start();
  };

  const restart = () => {
    setBubbles([]); setStep(0); setTiers([]); setDone(false); setInput("");
    startRef.current = Date.now();
  };

  const score = tiers.length ? Math.round((tiers.reduce((s, t) => s + t, 0) / (tiers.length * 3)) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <button onClick={onBack} className="btn-press focus-ring mb-4 flex items-center gap-1.5 text-sm font-bold text-mute hover:text-ink dark:text-faint dark:hover:text-snow">
        <ArrowLeft size={15} /> All conversations
      </button>

      <Card className="anim-pop p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Chip tone={scenario.domain === "medical" ? "med" : "pine"}>{scenario.domain}</Chip>
              <Chip><MessagesSquare size={11} /> {scenario.partner}</Chip>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold">{scenario.title}</h1>
            <p className="text-sm text-mute dark:text-faint">{scenario.role} · {scenario.setting}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold">{score}%</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">live score</p>
          </div>
        </div>
        <ProgressBar value={(step / scenario.turns.length) * 100} className="mt-3 h-1.5" />
      </Card>

      <div className="mt-4 space-y-3">
        {bubbles.map((b, i) => (
          <div key={i} className={cx("anim-rise flex", b.who === "user" ? "justify-end" : "justify-start")}>
            <div className={cx(
              "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm",
              b.who === "user"
                ? "rounded-br-md bg-pine-600 text-white"
                : b.who === "tutor"
                  ? "rounded-bl-md border border-gold-300 bg-gold-100/80 text-ink dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-snow"
                  : "rounded-bl-md border border-line bg-panel dark:border-nline dark:bg-carbon",
            )}>
              {b.who === "partner" && (
                <button onClick={() => speak(b.text, { rate: 0.95 })} className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-pine-600 hover:underline dark:text-pine-300">
                  <Volume2 size={11} /> {scenario.partner}
                </button>
              )}
              {b.who === "tutor" && <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gold-600 dark:text-gold-300">Tutor</p>}
              {b.text}
              {b.who === "user" && b.tier !== undefined && (
                <span className={cx("mt-1.5 flex items-center gap-1 text-[11px] font-bold", b.tier >= 2 ? "text-pine-100" : "text-gold-100")}>
                  <Check size={12} /> {TIER_LABEL[b.tier]}
                </span>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="anim-rise flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-panel px-4 py-3 dark:border-nline dark:bg-carbon">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {!done && cur?.speaker === "user" && !typing && (
        <Card className="anim-rise sticky bottom-20 mt-4 p-4 lg:bottom-4">
          <p className="text-xs font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Your turn</p>
          <p className="mt-1 text-sm font-medium">{cur.context}</p>
          <div className="mt-3 flex items-end gap-2">
            {supported && (
              <button
                onClick={listening ? () => recRef.current?.stop() : startMic}
                className={cx("btn-press focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", listening ? "streak-live bg-clay-500" : "bg-ink dark:bg-snow dark:text-night")}
                aria-label="Dictate with microphone"
              >
                {listening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
            )}
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Type your reply in English…"
              className="focus-ring h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-paper/60 px-4 text-[15px] focus:border-pine-500 dark:border-nline dark:bg-night/60"
            />
            <Button onClick={submit} disabled={!input.trim()}>Send</Button>
          </div>
        </Card>
      )}

      {done && (
        <Card className="anim-pop mt-4 p-6 text-center">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Dialogue complete</p>
          <p className="mt-2 font-display text-5xl font-extrabold">{score}%</p>
          <div className="mt-3 flex justify-center gap-2">
            {tiers.map((t, i) => (
              <Chip key={i} tone={t >= 2 ? "pine" : t === 1 ? "gold" : "clay"}>turn {i + 1} · {TIER_LABEL[t].split(",")[0].toLowerCase()}</Chip>
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={restart}><RotateCcw size={14} /> Run it again</Button>
            <Button onClick={onBack}>Back to scenarios</Button>
          </div>
        </Card>
      )}

      {!done && (
        <p className="mt-4 text-center text-xs text-faint">
          <Play size={11} className="mr-1 inline" />Tip: tap any partner line to hear it spoken naturally.
        </p>
      )}
    </div>
  );
}
