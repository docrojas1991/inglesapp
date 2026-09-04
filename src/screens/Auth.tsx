import { useEffect, useMemo, useState } from "react";
import type { Verdict } from "../lib/types";
import { PHRASES } from "../lib/data";
import { useApp } from "../store";
import { speak } from "../lib/audio";
import { Button, Card, Chip, cx } from "../ui";
import {
  ArrowRight, ArrowLeft, BookOpen, BrainCircuit, Check, Ear, FlaskConical, HeartPulse,
  Languages, LineChart, Mail, Mic, UserRound, Volume2, Zap,
} from "lucide-react";

function Wordmark({ big }: { big?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cx("flex items-center justify-center rounded-xl bg-pine-600 text-white shadow-lift", big ? "h-11 w-11" : "h-8 w-8")}>
        <Languages size={big ? 22 : 16} />
      </span>
      <span className={cx("font-display font-extrabold tracking-tight", big ? "text-3xl" : "text-xl")}>
        fluencia<span className="text-pine-600 dark:text-pine-300">.</span>
      </span>
    </span>
  );
}

export function Auth() {
  const { login, register, demoLogin } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const tickerPhrases = useMemo(() => [...PHRASES].sort(() => Math.random() - 0.5).slice(0, 10), []);
  useEffect(() => {
    const t = setInterval(() => setTick((i) => i + 1), 2800);
    return () => clearInterval(t);
  }, []);
  const tp = tickerPhrases[tick % tickerPhrases.length];

  const submit = async () => {
    setErr(null);
    setBusy(true);
    const r = mode === "login" ? await login(email, pw) : await register(name, email, pw);
    setBusy(false);
    if (r) setErr(r);
  };

  return (
    <div className="relative flex min-h-screen">
      <div className="ambient" />
      {/* left brand panel */}
      <div className="relative z-10 hidden w-1/2 flex-col justify-between border-r border-line bg-panel/70 p-10 backdrop-blur-sm lg:flex dark:border-nline dark:bg-carbon/60">
        <Wordmark big />
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">English mastery trainer · ES → EN</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.05] tracking-tight">
            500 phrases.<br />Actually <span className="text-pine-600 dark:text-pine-300">remembered.</span>
          </h1>
          <p className="mt-4 max-w-md text-mute dark:text-faint">
            Active recall and spaced repetition decide <em>when</em> each phrase returns — minutes, days, then weeks later —
            until you can understand it, retrieve it, say it, and use it without thinking.
          </p>

          <div className="mt-8 min-h-24">
            <div key={tick} className="anim-ticker max-w-md rounded-2xl border border-line bg-panel p-5 shadow-lift dark:border-nline dark:bg-carbon">
              <div className="flex items-center justify-between">
                <Chip tone={tp?.domain === "medical" ? "med" : "pine"}>{tp?.domain === "medical" ? <HeartPulse size={11} /> : <BookOpen size={11} />} {tp?.domain}</Chip>
                <button onClick={() => speak(tp?.en ?? "", { rate: 0.95 })} className="btn-press focus-ring rounded-lg bg-pine-50 p-2 text-pine-700 hover:bg-pine-100 dark:bg-pine-900/50 dark:text-pine-300" aria-label="Play phrase">
                  <Volume2 size={14} />
                </button>
              </div>
              <p className="mt-2.5 font-display text-2xl font-bold">“{tp?.en}”</p>
              <p className="text-mute dark:text-faint">{tp?.es}</p>
            </div>
          </div>

          <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-xs font-semibold text-mute dark:text-faint">
            <span className="flex items-center gap-1.5"><BrainCircuit size={14} className="text-pine-600 dark:text-pine-300" /> SM-2 scheduling</span>
            <span className="flex items-center gap-1.5"><Mic size={14} className="text-pine-600 dark:text-pine-300" /> Speaking practice</span>
            <span className="flex items-center gap-1.5"><LineChart size={14} className="text-pine-600 dark:text-pine-300" /> Retention metrics</span>
            <span className="flex items-center gap-1.5"><Ear size={14} className="text-pine-600 dark:text-pine-300" /> Dictation drills</span>
            <span className="flex items-center gap-1.5"><FlaskConical size={14} className="text-pine-600 dark:text-pine-300" /> Medical English</span>
            <span className="flex items-center gap-1.5"><Zap size={14} className="text-pine-600 dark:text-pine-300" /> Long-term checks</span>
          </div>
        </div>
        <p className="text-xs text-faint">70% everyday American English · 30% clinical communication for medical assistants</p>
      </div>

      {/* right form */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden"><Wordmark big /></div>
          <Card className="anim-pop p-7 sm:p-8">
            <div className="mb-6 flex rounded-xl border border-line bg-paper p-1 dark:border-nline dark:bg-night">
              {(["signup", "login"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setErr(null); }}
                  className={cx("btn-press focus-ring flex-1 rounded-lg py-2 text-sm font-bold",
                    mode === m ? "bg-panel shadow-sm dark:bg-carbon2" : "text-mute hover:text-ink dark:text-faint dark:hover:text-snow")}>
                  {m === "signup" ? "Create account" : "Sign in"}
                </button>
              ))}
            </div>

            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              {mode === "signup" ? "Start training your memory." : "Welcome back."}
            </h2>
            <p className="mt-1 text-sm text-mute dark:text-faint">
              {mode === "signup" ? "Your progress lives on this device, tied to your account." : "Your review queue kept working while you were away."}
            </p>

            <div className="mt-5 space-y-3">
              {mode === "signup" && (
                <Field icon={<UserRound size={15} />} label="Name">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rosa Martínez"
                    className="focus-ring w-full bg-transparent text-sm font-medium outline-none placeholder:text-faint/70" />
                </Field>
              )}
              <Field icon={<Mail size={15} />} label="Email">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="focus-ring w-full bg-transparent text-sm font-medium outline-none placeholder:text-faint/70" />
              </Field>
              <Field icon={<Zap size={15} />} label="Password">
                <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" type="password"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="focus-ring w-full bg-transparent text-sm font-medium outline-none placeholder:text-faint/70" />
              </Field>
            </div>

            {err && <p className="anim-rise mt-3 rounded-lg bg-clay-100 px-3 py-2 text-sm font-semibold text-clay-600 dark:bg-clay-500/15 dark:text-clay-400">{err}</p>}

            <Button size="lg" className="mt-5 w-full" onClick={submit} disabled={busy}>
              {busy ? "One second…" : mode === "signup" ? <>Create account <ArrowRight size={16} /></> : <>Sign in <ArrowRight size={16} /></>}
            </Button>

            <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-faint">
              <span className="h-px flex-1 bg-line dark:bg-nline" /> or <span className="h-px flex-1 bg-line dark:bg-nline" />
            </div>
            <Button variant="outline" className="w-full" onClick={demoLogin}>
              <FlaskConical size={15} /> Explore the demo account
            </Button>
            <p className="mt-2 text-center text-xs text-faint">Pre-seeded with 6 weeks of realistic progress — new, weak, due and mastered phrases included.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-faint">{label}</span>
      <span className="flex items-center gap-2.5 rounded-xl border-2 border-line bg-paper/60 px-3.5 py-3 transition-colors focus-within:border-pine-500 dark:border-nline dark:bg-night/60">
        <span className="text-faint">{icon}</span>
        {children}
      </span>
    </label>
  );
}

/* ---------------- Onboarding ---------------- */

export function Onboarding() {
  const { finishOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<5 | 10 | 15 | 20>(10);
  const [focus, setFocus] = useState<"everyday" | "balanced" | "medical">("balanced");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");

  const diag = useMemo(() => [...PHRASES].sort(() => Math.random() - 0.5).slice(0, 6), []);
  const [qi, setQi] = useState(0);
  const [diagResults, setDiagResults] = useState<{ phraseId: string; verdict: Verdict }[]>([]);

  const options = useMemo(() => {
    return diag.map((p) => {
      const others = PHRASES.filter((x) => x.id !== p.id).sort(() => Math.random() - 0.5).slice(0, 3).map((x) => x.es);
      return [...others, p.es].sort(() => Math.random() - 0.5);
    });
  }, [diag]);

  const answer = (opt: string) => {
    const p = diag[qi];
    const verdict: Verdict = opt === p.es ? "correct" : "incorrect";
    const results = [...diagResults, { phraseId: p.id, verdict }];
    setDiagResults(results);
    if (qi + 1 < diag.length) setQi(qi + 1);
    else finishOnboarding({ dailyGoalMinutes: goal, focus, level }, results);
  };

  const steps = ["Daily goal", "Focus", "Level", "Diagnostic"];

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="ambient" />
      <div className="relative z-10 w-full max-w-xl">
        <div className="mb-6 text-center"><Wordmark big /></div>
        <Card className="anim-pop p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
                <span className={cx("h-1.5 w-full rounded-full transition-colors", i <= step ? "bg-pine-600" : "bg-line dark:bg-nline")} />
                <span className={cx("text-[9px] font-bold uppercase tracking-widest", i <= step ? "text-pine-700 dark:text-pine-300" : "text-faint")}>{s}</span>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="anim-rise">
              <h2 className="font-display text-2xl font-extrabold tracking-tight">How much English per day?</h2>
              <p className="mt-1 text-sm text-mute dark:text-faint">Spaced repetition works in small daily doses. You can change this anytime.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {([["Casual", 5, "a light touch"], ["Regular", 10, "steady gains"], ["Serious", 15, "fast progress"], ["Intensive", 20, "all in"]] as const).map(([label, m, sub]) => (
                  <button key={m} onClick={() => setGoal(m)}
                    className={cx("btn-press focus-ring rounded-2xl border-2 p-4 text-left",
                      goal === m ? "border-pine-500 bg-pine-50 dark:bg-pine-900/40" : "border-line hover:border-pine-300 dark:border-nline")}>
                    <p className="font-display text-lg font-bold">{label} · {m}m</p>
                    <p className="text-xs text-mute dark:text-faint">{sub}</p>
                  </button>
                ))}
              </div>
              <Button size="lg" className="mt-6 w-full" onClick={() => setStep(1)}>Continue <ArrowRight size={16} /></Button>
            </div>
          )}

          {step === 1 && (
            <div className="anim-rise">
              <h2 className="font-display text-2xl font-extrabold tracking-tight">What should we prioritize?</h2>
              <p className="mt-1 text-sm text-mute dark:text-faint">This shapes which new phrases appear first.</p>
              <div className="mt-5 space-y-3">
                {([["Everyday English", "everyday", "Natural American conversations — plans, calls, work, small talk.", <BookOpen key="a" size={19} />],
                ["Balanced", "balanced", "A 70/30 mix of everyday and medical communication.", <Languages key="b" size={19} />],
                ["Medical English", "medical", "Patient intake, vitals, blood draws, lab calls, clinical workflow.", <HeartPulse key="c" size={19} />]] as const).map(([label, id, sub, icon]) => (
                  <button key={id} onClick={() => setFocus(id)}
                    className={cx("btn-press focus-ring flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left",
                      focus === id ? "border-pine-500 bg-pine-50 dark:bg-pine-900/40" : "border-line hover:border-pine-300 dark:border-nline")}>
                    <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", id === "medical" ? "bg-med-100 text-med-600 dark:bg-med-500/15 dark:text-med-400" : "bg-pine-50 text-pine-700 dark:bg-pine-900/50 dark:text-pine-300")}>{icon}</span>
                    <span>
                      <p className="font-display text-base font-bold">{label}</p>
                      <p className="text-xs text-mute dark:text-faint">{sub}</p>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft size={15} /> Back</Button>
                <Button size="lg" className="flex-1" onClick={() => setStep(2)}>Continue <ArrowRight size={16} /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="anim-rise">
              <h2 className="font-display text-2xl font-extrabold tracking-tight">Where's your English today?</h2>
              <p className="mt-1 text-sm text-mute dark:text-faint">Be honest — the scheduler adapts either way.</p>
              <div className="mt-5 space-y-3">
                {([["Beginner", "beginner", "I understand a little; I start with easier phrases."],
                ["Intermediate", "intermediate", "I get by, but natural phrases don't come automatically."],
                ["Advanced", "advanced", "Push me — production and context from day one."]] as const).map(([label, id, sub]) => (
                  <button key={id} onClick={() => setLevel(id)}
                    className={cx("btn-press focus-ring w-full rounded-2xl border-2 p-4 text-left",
                      level === id ? "border-pine-500 bg-pine-50 dark:bg-pine-900/40" : "border-line hover:border-pine-300 dark:border-nline")}>
                    <p className="font-display text-base font-bold">{label}</p>
                    <p className="text-xs text-mute dark:text-faint">{sub}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</Button>
                <Button size="lg" className="flex-1" onClick={() => setStep(3)}>Start diagnostic <ArrowRight size={16} /></Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="anim-rise">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Quick diagnostic · {qi + 1}/{diag.length}</p>
                <Chip>no stakes — just calibration</Chip>
              </div>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight">“{diag[qi].en}”</h2>
              <p className="mt-1 text-sm text-mute dark:text-faint">What does it mean?</p>
              <div className="stagger mt-5 grid gap-2">
                {options[qi].map((o, i) => (
                  <button key={i} onClick={() => answer(o)}
                    className="btn-press focus-ring rounded-xl border-2 border-line bg-panel px-4 py-3 text-left text-[15px] font-medium hover:border-pine-400 hover:bg-pine-50 dark:border-nline dark:bg-carbon dark:hover:bg-pine-900/30" dir="auto">
                    <span className="mr-2 font-mono text-xs font-bold text-faint">{i + 1}</span>{o}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {diag.map((_, i) => (
                  <span key={i} className={cx("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    i < qi ? (diagResults[i]?.verdict === "correct" ? "bg-pine-600 text-white" : "bg-clay-500 text-white") : i === qi ? "bg-pine-100 text-pine-700 dark:bg-pine-900 dark:text-pine-300" : "bg-line text-faint dark:bg-nline")}>
                    {i < qi ? (diagResults[i]?.verdict === "correct" ? <Check size={11} /> : "×") : i + 1}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
        <p className="mt-4 text-center text-xs text-faint">
          You'll learn through active recall and spaced repetition — the app decides when each phrase should return for review.
        </p>
      </div>
    </div>
  );
}
