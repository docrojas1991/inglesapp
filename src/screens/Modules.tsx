import { useMemo, useState } from "react";
import { useApp } from "../store";
import { MODULES } from "../lib/data";
import {
  buildLessonPlan, buildReviewPlan, buildTestPlan, getState, moduleUnlocked, phrasesOfModule,
} from "../lib/engine";
import { Button, Card, Chip, ProgressBar, cx } from "../ui";
import {
  ArrowLeft, BookOpen, Check, ChevronRight, FlaskConical, HeartPulse, Lock, Play, Stethoscope, Target,
} from "lucide-react";

export function Modules() {
  const { phrases, data } = useApp();
  const [selected, setSelected] = useState<number | null>(null);

  if (selected !== null) {
    return <ModuleDetail id={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <div className="anim-rise">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Curriculum</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">10 modules · 500-phrase track</h1>
        <p className="mt-1 max-w-2xl text-sm text-mute dark:text-faint">
          70% everyday American English, 30% medical communication for healthcare work. Modules unlock when you
          <em> demonstrate</em> retention — not just by clicking through.
        </p>
      </div>

      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) => {
          const mp = phrasesOfModule(m.id, data.customPhrases);
          const mastered = mp.filter((p) => (data.progress[p.id]?.mastery ?? 0) >= 75).length;
          const learning = mp.filter((p) => { const pr = data.progress[p.id]; return pr && pr.timesSeen > 0 && pr.mastery < 75; }).length;
          const due = mp.filter((p) => { const pr = data.progress[p.id]; return pr?.nextReview !== undefined && pr.nextReview <= Date.now(); }).length;
          const unlocked = moduleUnlocked(m.id, data, phrases);
          const test = data.moduleTests[m.id];
          const pct = mp.length ? Math.round((mastered / mp.length) * 100) : 0;
          return (
            <Card key={m.id} className={cx("relative overflow-hidden p-5", unlocked && "group")} onClick={unlocked ? () => setSelected(m.id) : undefined}>
              <div className={cx("pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full", m.domain === "medical" ? "bg-med-100/70 dark:bg-med-500/10" : "bg-pine-50 dark:bg-pine-900/30")} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className={cx("font-display text-4xl font-extrabold", m.domain === "medical" ? "text-med-500/80" : "text-pine-600/70 dark:text-pine-400/70")}>
                    {String(m.id).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-2">
                    {test?.passed && <Chip tone="pine"><Check size={11} /> test {test.score}%</Chip>}
                    {!unlocked && <Chip><Lock size={11} /> locked</Chip>}
                    <Chip tone={m.domain === "medical" ? "med" : "pine"}>
                      {m.domain === "medical" ? <Stethoscope size={11} /> : <BookOpen size={11} />} {m.domain}
                    </Chip>
                  </div>
                </div>
                <h2 className={cx("mt-2 font-display text-xl font-bold", !unlocked && "text-faint")}>{m.title}</h2>
                <p className="mt-0.5 text-sm text-mute dark:text-faint">{m.blurb}</p>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={pct} tone={m.domain === "medical" ? "med" : "pine"} className="flex-1" />
                  <span className="font-mono text-xs font-bold">{mastered}/{mp.length}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute dark:text-faint">
                  <span>{learning} learning</span>
                  {due > 0 && <span className="font-semibold text-clay-500">{due} due</span>}
                  <span className="ml-auto font-semibold text-pine-600 group-hover:underline dark:text-pine-300">
                    {unlocked ? "Open module" : "Pass previous test to unlock"} <ChevronRight size={12} className="inline" />
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function lessonChunks(n: number): [number, number][] {
  if (n <= 6) {
    const half = Math.ceil(n / 2);
    return [[0, half], [half, n]];
  }
  const chunks: [number, number][] = [];
  for (let i = 0; i < n; i += 5) chunks.push([i, Math.min(n, i + 5)]);
  return chunks;
}

function ModuleDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { data, startPractice, phrases } = useApp();
  const mod = MODULES.find((m) => m.id === id)!;
  const mp = useMemo(() => phrasesOfModule(id, data.customPhrases), [id, data.customPhrases]);
  const chunks = useMemo(() => lessonChunks(mp.length), [mp.length]);
  const unlocked = moduleUnlocked(id, data, phrases);
  const test = data.moduleTests[id];

  const lessonState = (i: number): "done" | "active" | "locked" => {
    const lid = `m${id}-l${i + 1}`;
    if (data.lessonsDone.includes(lid)) return "done";
    const prevDone = i === 0 || data.lessonsDone.includes(`m${id}-l${i}`);
    return prevDone ? "active" : "locked";
  };

  const startLesson = (i: number) => {
    const [a, b] = chunks[i];
    const lessonPhrases = mp.slice(a, b);
    startPractice({
      title: `Module ${id} · Lesson ${i + 1}`,
      subtitle: lessonPhrases.map((p) => p.en).slice(0, 2).join(" · ") + "…",
      mode: "lesson",
      metaId: `m${id}-l${i + 1}`,
      items: buildLessonPlan(lessonPhrases, data.progress),
    });
  };

  const startModuleReview = () => {
    startPractice({
      title: `Module ${id} · Review`,
      subtitle: "All module phrases, weighted by weakness",
      mode: "review",
      items: buildReviewPlan(mp.map((p) => p.id), phrases, data.progress, data.settings),
    });
  };

  const startTest = () => {
    startPractice({
      title: `Module ${id} · Final test`,
      subtitle: "Mixed production, listening & context — 70% to pass",
      mode: "test",
      metaId: `test-${id}`,
      items: buildTestPlan(mp, data.progress, data.settings.speakingEnabled),
    });
  };

  const mastered = mp.filter((p) => (data.progress[p.id]?.mastery ?? 0) >= 75).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <button onClick={onBack} className="btn-press focus-ring mb-4 flex items-center gap-1.5 text-sm font-bold text-mute hover:text-ink dark:text-faint dark:hover:text-snow">
        <ArrowLeft size={15} /> All modules
      </button>

      <Card className="anim-pop overflow-hidden">
        <div className={cx("h-2", mod.domain === "medical" ? "bg-med-500" : "bg-pine-600")} />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={mod.domain === "medical" ? "med" : "pine"}>Module {id}</Chip>
            <Chip>{mod.domain === "medical" ? "Medical English" : "Everyday English"}</Chip>
            {test && <Chip tone={test.passed ? "pine" : "clay"}>Test {test.score}% · {test.passed ? "passed" : "not passed"}</Chip>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{mod.title}</h1>
          <p className="mt-1 text-mute dark:text-faint">{mod.blurb}</p>
          <div className="mt-4 flex items-center gap-3">
            <ProgressBar value={(mastered / Math.max(1, mp.length)) * 100} tone={mod.domain === "medical" ? "med" : "pine"} className="flex-1" />
            <span className="font-mono text-sm font-bold">{mastered}/{mp.length} mastered</span>
          </div>
        </div>
      </Card>

      {!unlocked && (
        <Card className="anim-rise mt-4 border-gold-300 bg-gold-100/60 p-5 dark:border-gold-400/30 dark:bg-gold-400/10">
          <p className="flex items-center gap-2 font-display font-bold"><Lock size={16} className="text-gold-600" /> Module locked</p>
          <p className="mt-1 text-sm text-ink/80 dark:text-snow/80">
            Pass the Module {id - 1} test (or reach 60% average mastery across its phrases) to unlock this module. That gate exists so earlier phrases are truly retained before new load arrives.
          </p>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {chunks.map((c, i) => {
          const st = unlocked ? lessonState(i) : "locked";
          const slice = mp.slice(c[0], c[1]);
          return (
            <Card key={i} className={cx("flex items-center gap-4 p-4", st === "locked" && "opacity-60")}>
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-lg font-extrabold",
                st === "done" ? "bg-pine-600 text-white" : st === "active" ? "bg-pine-50 text-pine-700 dark:bg-pine-900/50 dark:text-pine-300" : "bg-paper text-faint dark:bg-carbon2")}>
                {st === "done" ? <Check size={18} /> : st === "locked" ? <Lock size={16} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">Lesson {i + 1} <span className="text-sm font-normal text-faint">· phrases {c[0] + 1}–{c[1]}</span></p>
                <p className="truncate text-xs text-mute dark:text-faint">{slice.map((p) => p.en).join(" · ")}</p>
              </div>
              {st === "done" && <Chip tone="pine">complete</Chip>}
              {st === "active" && <Button size="sm" onClick={() => startLesson(i)}><Play size={13} /> Start</Button>}
            </Card>
          );
        })}

        <Card className="flex items-center gap-4 border-dashed p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600 dark:bg-gold-400/15">
            <FlaskConical size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold">Module review</p>
            <p className="text-xs text-mute dark:text-faint">Spaced-repetition drill across all {mp.length} phrases.</p>
          </div>
          <Button size="sm" variant="outline" disabled={!unlocked} onClick={startModuleReview}>Review</Button>
        </Card>

        <Card className={cx("relative overflow-hidden p-5", !unlocked && "opacity-60")}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-med-100/80 dark:bg-med-500/10" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-gold-300 dark:bg-snow dark:text-pine-800">
              <Target size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold">Final module test</p>
              <p className="text-xs text-mute dark:text-faint">
                10 mixed exercises: translation, dictation, listening, context &amp; speaking. Score ≥ 70% unlocks Module {id + 1}.
              </p>
            </div>
            <Button onClick={startTest} disabled={!unlocked} variant="dark"><HeartPulse size={15} /> Take test</Button>
          </div>
          {test && !test.passed && (
            <p className="relative mt-3 rounded-lg bg-clay-100 px-3 py-2 text-xs font-semibold text-clay-600 dark:bg-clay-500/15 dark:text-clay-400">
              Last attempt {test.score}% — review the weak phrases below, then retake it.
            </p>
          )}
        </Card>

        {/* phrase roster with live states */}
        <Card className="p-5">
          <p className="mb-3 font-display font-bold">Phrase roster</p>
          <div className="grid gap-1.5">
            {mp.map((p, i) => {
              const pr = data.progress[p.id];
              const st = getState(pr);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-paper/70 dark:odd:bg-night/50">
                  <span className="w-6 font-mono text-[10px] font-bold text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.en}</span>
                  <span className="hidden max-w-40 truncate text-xs text-faint sm:block" dir="auto">{p.es}</span>
                  <span className="w-20"><ProgressBar value={pr?.mastery ?? 0} className="h-1.5" /></span>
                  <span className="w-16 text-right font-mono text-[10px] font-bold text-mute dark:text-faint">{st.replace(/_/g, " ")}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
