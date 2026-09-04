import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";
import {
  buildDailyPlan, computeBuckets, computeStats, dueCount, getState, masteryBand,
  recommendations, todayKey,
} from "../lib/engine";
import { MODULES } from "../lib/data";
import { AreaLine, BarChart, Button, Card, Chip, Donut, ProgressBar, Ring, cx } from "../ui";
import {
  ArrowRight, BookOpen, CalendarDays, ChevronRight, Flame, HeartPulse, Lightbulb, Play,
  Stethoscope, Target, TrendingUp, Zap,
} from "lucide-react";

export function Dashboard() {
  const { data, phrases, nav, startPractice, toast } = useApp();
  const [minutes, setMinutes] = useState<number>(data.settings.dailyGoalMinutes);
  const [tickerIdx, setTickerIdx] = useState(0);
  const now = Date.now();

  const buckets = useMemo(
    () => computeBuckets(phrases, data.progress, data.settings, data.paused, now),
    [phrases, data.progress, data.settings, data.paused, now],
  );
  const stats = useMemo(() => computeStats(data, phrases, now), [data, phrases, now]);
  const recs = useMemo(() => recommendations(data, phrases, now), [data, phrases, now]);

  const newLearnedToday = useMemo(() => {
    const tk = todayKey(now);
    return Object.values(data.progress).filter((p) => p.firstLearned && todayKey(p.firstLearned) === tk).length;
  }, [data.progress, now]);

  const preview = useMemo(() => {
    const plan = buildDailyPlan(phrases, data.progress, data.settings, data.paused, minutes, newLearnedToday, now);
    return { plan, est: Math.max(4, Math.round(plan.length / 1.35)) };
  }, [phrases, data.progress, data.settings, data.paused, minutes, newLearnedToday, now]);

  const duePhrases = useMemo(() => {
    const ids = [...new Set(preview.plan.map((i) => i.phraseId))];
    return ids.map((id) => phrases.find((p) => p.id === id)).filter(Boolean).slice(0, 6);
  }, [preview.plan, phrases]);

  useEffect(() => {
    if (!duePhrases.length) return;
    const t = setInterval(() => setTickerIdx((i) => i + 1), 3200);
    return () => clearInterval(t);
  }, [duePhrases.length]);

  const todayLog = data.dailyLog[todayKey(now)];
  const goalPct = todayLog ? Math.min(100, Math.round((todayLog.minutes / data.settings.dailyGoalMinutes) * 100)) : 0;
  const goalDone = todayLog && todayLog.minutes >= data.settings.dailyGoalMinutes;

  const startToday = () => {
    if (!preview.plan.length) {
      toast("Nothing due and no new phrases left — you're fully caught up!", "gold");
      return;
    }
    startPractice({
      title: "Today's practice",
      subtitle: `${preview.plan.length} exercises · ~${preview.est} min`,
      mode: "daily",
      items: preview.plan,
    });
  };

  const currentModule = useMemo(() => {
    for (const m of MODULES) {
      const mp = phrases.filter((p) => p.module === m.id);
      const avg = mp.reduce((s, p) => s + (data.progress[p.id]?.mastery ?? 0), 0) / Math.max(1, mp.length);
      if (avg < 75) return { m, avg: Math.round(avg) };
    }
    return { m: MODULES[MODULES.length - 1], avg: 100 };
  }, [phrases, data.progress]);

  const weakPhrases = useMemo(
    () => phrases
      .filter((p) => data.progress[p.id]?.timesSeen > 0 && data.progress[p.id].mastery < 40)
      .sort((a, b) => (data.progress[a.id]?.mastery ?? 0) - (data.progress[b.id]?.mastery ?? 0))
      .slice(0, 5),
    [phrases, data.progress],
  );

  const recent = data.history.slice(-5).reverse();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = useApp().user?.name?.split(" ")[0] ?? "there";
  const tickPhrase = duePhrases.length ? duePhrases[tickerIdx % duePhrases.length] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      {/* header row */}
      <div className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {greet}, {firstName}.
          </h1>
          <p className="mt-1 text-sm text-mute dark:text-faint">
            {stats.dueToday > 0
              ? `${stats.dueToday} phrase${stats.dueToday === 1 ? "" : "s"} are waiting for review — memory consolidates when you return.`
              : stats.byState.NEW > 0
                ? "No reviews due — a perfect moment to learn something new."
                : "Everything reviewed. A verification round keeps long-term memory honest."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cx("flex items-center gap-2 rounded-xl border px-3 py-2", data.streak.current > 0 ? "border-gold-300 bg-gold-100/70 dark:border-gold-400/30 dark:bg-gold-400/10" : "border-line bg-panel dark:border-nline dark:bg-carbon")}>
            <Flame size={18} className={data.streak.current > 0 ? "text-gold-500" : "text-faint"} />
            <div className="leading-none">
              <p className="font-display text-lg font-extrabold">{data.streak.current}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-faint">day streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 dark:border-nline dark:bg-carbon">
            <Zap size={18} className="text-pine-600 dark:text-pine-300" />
            <div className="leading-none">
              <p className="font-display text-lg font-extrabold">{data.totalXp.toLocaleString()}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-faint">total XP</p>
            </div>
          </div>
          <Ring value={goalPct} size={52} stroke={5} tone={goalDone ? "pine" : "gold"}
            label={<span className="font-display text-xs font-extrabold">{goalDone ? "✓" : `${goalPct}%`}</span>} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* LEFT — start card + charts */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="anim-pop relative overflow-hidden p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-pine-100/80 dark:bg-pine-900/40" />
            <div className="relative">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Today's session</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip tone="clay">{buckets.overdue.length} due</Chip>
                <Chip tone="gold">{Math.min(buckets.weak.length, 8)} weak</Chip>
                <Chip tone="pine">{Math.min(buckets.newPhrases.length, Math.max(0, data.settings.newPerDay - newLearnedToday))} new</Chip>
                <Chip>{buckets.freshCount} fresh</Chip>
                <Chip><Target size={11} /> ~{preview.est} min</Chip>
              </div>
              <div className="mt-5 flex h-8 items-center overflow-hidden">
                {tickPhrase ? (
                  <p key={tickPhrase.id + tickerIdx} className="anim-ticker font-display text-lg font-bold text-ink/80 dark:text-snow/80">
                    Up next · “{tickPhrase.en}” <span className="font-body text-sm font-normal text-mute dark:text-faint">— {tickPhrase.es}</span>
                  </p>
                ) : (
                  <p className="font-display text-lg font-bold text-ink/80 dark:text-snow/80">Your queue is ready when you are.</p>
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={startToday} className="w-full sm:w-auto">
                  <Play size={18} /> Start today's practice
                </Button>
                <div className="flex rounded-xl border border-line bg-paper p-1 dark:border-nline dark:bg-night">
                  {[5, 10, 15, 20].map((m) => (
                    <button key={m} onClick={() => setMinutes(m)}
                      className={cx("btn-press focus-ring rounded-lg px-3 py-1.5 text-xs font-bold",
                        minutes === m ? "bg-panel shadow-sm dark:bg-carbon2" : "text-mute hover:text-ink dark:text-faint dark:hover:text-snow")}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="stagger grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold">Weekly activity</h3>
                <Chip>{stats.weekMinutes.reduce((a, b) => a + b, 0)} min</Chip>
              </div>
              <BarChart values={stats.weekMinutes} labels={stats.weekLabels} />
            </Card>
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold">Accuracy trend</h3>
                <Chip tone="pine">{stats.accuracy || "—"}%</Chip>
              </div>
              {stats.accuracyTrend.length > 1 ? (
                <AreaLine points={stats.accuracyTrend} />
              ) : (
                <p className="py-6 text-center text-sm text-faint">Finish two sessions to see your trend.</p>
              )}
            </Card>
          </div>

          <Card className="anim-rise p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Recent activity</h3>
              <button onClick={() => nav("history")} className="btn-press focus-ring text-xs font-bold text-pine-600 hover:underline dark:text-pine-300">View all</button>
            </div>
            {recent.length === 0 ? (
              <p className="py-4 text-center text-sm text-faint">Your sessions will appear here.</p>
            ) : (
              <div className="divide-y divide-line dark:divide-nline">
                {recent.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5">
                    <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg",
                      s.mode === "test" ? "bg-med-100 text-med-600 dark:bg-med-500/15" : s.mode === "review" ? "bg-gold-100 text-gold-600 dark:bg-gold-400/15" : "bg-pine-50 text-pine-600 dark:bg-pine-900/40 dark:text-pine-300")}>
                      {s.mode === "test" ? <Stethoscope size={15} /> : s.mode === "review" ? <TrendingUp size={15} /> : <BookOpen size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold capitalize">{s.mode} session</p>
                      <p className="text-xs text-faint">{s.exercises} exercises · {s.minutes} min · {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <span className="font-mono text-xs font-bold text-pine-600 dark:text-pine-300">
                      {Math.round(((s.correct + s.alt) / Math.max(1, s.exercises)) * 100)}%
                    </span>
                    <span className="font-mono text-xs font-bold text-gold-500">+{s.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT — progress column */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="anim-rise p-5">
            <div className="flex items-center gap-5">
              <Donut
                segments={[
                  { value: stats.byState.LONG_TERM_MASTERED + stats.byState.MASTERED, color: "var(--color-pine-600)" },
                  { value: stats.byState.STRONG, color: "var(--color-pine-400)" },
                  { value: stats.byState.REVIEWING + stats.byState.LEARNING + stats.byState.STRUGGLING + stats.byState.NEEDS_REVIEW, color: "var(--color-gold-400)" },
                  { value: stats.byState.NEW, color: "var(--color-line)" },
                ]}
                centerLabel={<span className="font-display text-2xl font-extrabold">{stats.overallMastery}%</span>}
                centerSub="mastery"
              />
              <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <LegendRow color="bg-pine-600" label="Mastered" value={stats.byState.MASTERED + stats.byState.LONG_TERM_MASTERED} />
                <LegendRow color="bg-pine-400" label="Strong" value={stats.byState.STRONG} />
                <LegendRow color="bg-gold-400" label="Learning" value={stats.byState.LEARNING + stats.byState.REVIEWING + stats.byState.STRUGGLING + stats.byState.NEEDS_REVIEW} />
                <LegendRow color="bg-line" label="New" value={stats.byState.NEW} />
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs font-semibold">
                <span className="text-mute dark:text-faint">{stats.masteredCount} / {stats.total} phrases mastered</span>
                <span className="font-mono">{Math.round((stats.masteredCount / Math.max(1, stats.total)) * 100)}%</span>
              </div>
              <ProgressBar value={(stats.masteredCount / Math.max(1, stats.total)) * 100} />
            </div>
          </Card>

          <Card className="anim-rise p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-bold"><Lightbulb size={16} className="text-gold-500" /> Smart recommendations</h3>
            <ul className="mt-3 space-y-2.5">
              {recs.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-snug text-ink/85 dark:text-snow/85">
                  <ChevronRight size={15} className="mt-0.5 shrink-0 text-pine-500" />{r}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="anim-rise cursor-pointer p-5" onClick={() => nav("modules")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-faint">Continue learning</p>
                <h3 className="mt-1 font-display text-lg font-bold">Module {currentModule.m.id} · {currentModule.m.title}</h3>
                <p className="text-xs text-mute dark:text-faint">{currentModule.m.domain === "medical" ? "Medical English" : "Everyday English"} · {currentModule.avg}% mastery</p>
              </div>
              {currentModule.m.domain === "medical"
                ? <HeartPulse size={26} className="text-med-500" />
                : <BookOpen size={26} className="text-pine-600 dark:text-pine-300" />}
            </div>
            <ProgressBar value={currentModule.avg} tone={currentModule.m.domain === "medical" ? "med" : "pine"} className="mt-3" />
          </Card>

          <Card className="anim-rise p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Needs attention</h3>
              <button onClick={() => nav("review")} className="btn-press focus-ring text-xs font-bold text-pine-600 hover:underline dark:text-pine-300">Review center</button>
            </div>
            {weakPhrases.length === 0 ? (
              <p className="py-2 text-sm text-faint">Nothing is slipping — nice work.</p>
            ) : (
              <div className="space-y-2">
                {weakPhrases.map((p) => {
                  const pr = data.progress[p.id];
                  const st = getState(pr);
                  return (
                    <button key={p.id}
                      onClick={() => startPractice({ title: "Single phrase drill", mode: "single", items: [{ phraseId: p.id, ex: "es_en", bucket: "scope" }] })}
                      className="btn-press focus-ring group flex w-full items-center gap-3 rounded-xl border border-line bg-paper/60 px-3 py-2.5 text-left hover:border-pine-400 dark:border-nline dark:bg-night/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold group-hover:text-pine-700 dark:group-hover:text-pine-300">{p.en}</p>
                        <p className="truncate text-xs text-faint">{p.es}</p>
                      </div>
                      <span className="font-mono text-xs font-bold text-clay-500">{Math.round(pr?.mastery ?? 0)}%</span>
                      <ArrowRight size={14} className="text-faint group-hover:text-pine-500" />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="stagger grid grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-faint"><BookOpen size={12} /> Everyday</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{stats.everydayPct}%</p>
              <ProgressBar value={stats.everydayPct} className="mt-2 h-1.5" />
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-faint"><HeartPulse size={12} /> Medical</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{stats.medicalPct}%</p>
              <ProgressBar value={stats.medicalPct} tone="med" className="mt-2 h-1.5" />
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-faint"><CalendarDays size={12} /> Reviews today</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{todayLog?.exercises ?? 0}</p>
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-faint"><TrendingUp size={12} /> 7-day retention</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{stats.delayedAccuracy || "—"}%</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cx("h-2.5 w-2.5 shrink-0 rounded-sm", color)} />
      <span className="flex-1 text-xs text-mute dark:text-faint">{label}</span>
      <span className="font-mono text-xs font-bold">{value}</span>
    </div>
  );
}
