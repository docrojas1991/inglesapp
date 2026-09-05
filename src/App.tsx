import { useMemo } from "react";
import { PHRASES } from "./lib/data";
import type { Phrase } from "./lib/types";
import { AppProvider, useApp } from "./store";
import { Auth, Onboarding } from "./screens/Auth";
import { Dashboard } from "./screens/Dashboard";
import { PracticeScreen } from "./screens/Practice";
import { Library, ReviewCenter } from "./screens/Library";
import { Modules } from "./screens/Modules";
import { Conversations } from "./screens/Conversations";
import { StreetScreen } from "./screens/Street";
import { AiTutor } from "./screens/AiTutor";
import { History, Settings } from "./screens/More";
import { buildDailyPlan, todayKey } from "./lib/engine";
import { Ring, cx } from "./ui";
import {
  BookOpen, Clock, Flame, Languages, LayoutDashboard, LibraryBig, Menu, MessagesSquare,
  Mic, Moon, Play, Settings as SettingsIcon, Sun, TrendingUp, X, Zap,
} from "lucide-react";
import { useState } from "react";
import type { RouteId } from "./lib/types";

const NAV: { id: RouteId; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Today", icon: <LayoutDashboard size={17} /> },
  { id: "modules", label: "Modules", icon: <BookOpen size={17} /> },
  { id: "street", label: "Calle", icon: <Mic size={17} /> },
  { id: "review", label: "Review", icon: <TrendingUp size={17} /> },
  { id: "library", label: "Library", icon: <LibraryBig size={17} /> },
  { id: "conversations", label: "Conversations", icon: <MessagesSquare size={17} /> },
  { id: "history", label: "History", icon: <Clock size={17} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={17} /> },
];

function Shell() {
  const { user, data, booting, practice, route, nav, startPractice, updateSettings, toasts, dismissToast, toast } = useApp();
  const [sheet, setSheet] = useState(false);

  const newLearnedToday = useMemo(() => {
    const tk = todayKey();
    return Object.values(data.progress).filter((p) => p.firstLearned && todayKey(p.firstLearned) === tk).length;
  }, [data.progress]);

  const quickPractice = () => {
    setSheet(false);
    const items = buildDailyPlan(
      allPhrasesMemo(data.customPhrases), data.progress, data.settings, data.paused,
      data.settings.dailyGoalMinutes, newLearnedToday,
    );
    if (!items.length) {
      toast("Nothing due right now — check the Review center for custom drills.", "gold");
      return;
    }
    startPractice({ title: "Today's practice", subtitle: "Quick start from the nav", mode: "daily", items });
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="ambient" />
        <div className="anim-pop flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-600 text-white shadow-pop">
            <Languages size={24} />
          </span>
          <span className="font-display text-3xl font-extrabold tracking-tight">fluencia<span className="text-pine-600">.</span></span>
        </div>
      </div>
    );
  }

  if (!user) return <><Auth /><ToastHost toasts={toasts} dismiss={dismissToast} /></>;
  if (!data.onboarded) return <><Onboarding /><ToastHost toasts={toasts} dismiss={dismissToast} /></>;

  const tk = todayKey();
  const todayLog = data.dailyLog[tk];
  const goalPct = todayLog ? Math.min(100, Math.round((todayLog.minutes / data.settings.dailyGoalMinutes) * 100)) : 0;

  return (
    <div className="relative flex h-full h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden">
      <div className="ambient" />

      {/* top bar with iOS notch / safe-area padding */}
      <header className="sticky top-0 z-30 flex-shrink-0 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md dark:border-nline dark:bg-night/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button onClick={() => nav("dashboard")} className="btn-press focus-ring flex items-center gap-2" aria-label="Fluencia home">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pine-600 text-white"><Languages size={14} /></span>
            <span className="hidden font-display text-lg font-extrabold tracking-tight sm:inline">fluencia<span className="text-pine-600 dark:text-pine-300">.</span></span>
          </button>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className={cx("flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-xs font-bold",
              data.streak.current > 0 ? "bg-gold-100 text-gold-600 dark:bg-gold-400/15 dark:text-gold-300" : "bg-paper text-faint dark:bg-carbon2")}>
              <Flame size={13} className={data.streak.current > 0 ? "streak-live rounded-full" : ""} /> {data.streak.current}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-paper px-2 py-1 font-mono text-xs font-bold text-pine-700 dark:bg-carbon2 dark:text-pine-300">
              <Zap size={13} /> {data.totalXp.toLocaleString()}
            </span>
            <span className="hidden sm:inline-flex">
              <Ring value={goalPct} size={34} stroke={4} tone={goalPct >= 100 ? "pine" : "gold"}
                label={<span className="text-[8px] font-extrabold">{goalPct >= 100 ? "✓" : `${goalPct}%`}</span>} />
            </span>
            <button
              onClick={() => updateSettings({ darkMode: !data.settings.darkMode })}
              className="btn-press focus-ring rounded-lg border border-line bg-panel p-2 text-mute hover:text-ink dark:border-nline dark:bg-carbon dark:text-faint dark:hover:text-snow"
              aria-label="Toggle dark mode"
            >
              {data.settings.darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine-600 font-display text-xs font-extrabold text-white" title={user.email}>
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* sidebar (desktop) */}
      <nav className="fixed bottom-0 left-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-20 hidden w-56 flex-col gap-1 border-r border-line bg-panel/70 p-3 backdrop-blur-sm lg:flex dark:border-nline dark:bg-carbon/60">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => nav(n.id)}
            className={cx("btn-press focus-ring flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
              route === n.id ? "bg-pine-600 text-white shadow-lift" : "text-mute hover:bg-pine-50 hover:text-ink dark:text-faint dark:hover:bg-carbon2 dark:hover:text-snow")}
          >
            {n.icon} {n.label}
            {n.id === "review" && data && dueNow(data) > 0 && (
              <span className={cx("ml-auto rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold", route === n.id ? "bg-white/20 text-white" : "bg-clay-100 text-clay-600 dark:bg-clay-500/15 dark:text-clay-400")}>
                {dueNow(data)}
              </span>
            )}
          </button>
        ))}
        <div className="mt-auto rounded-xl border border-line bg-paper/70 p-3 dark:border-nline dark:bg-night/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Daily goal</p>
          <p className="mt-1 text-sm font-semibold">{todayLog?.minutes ?? 0} / {data.settings.dailyGoalMinutes} min</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line dark:bg-nline">
            <div className="anim-bar h-full rounded-full bg-gold-400" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      </nav>

      {/* main view: strictly scrollable inner viewport with iOS inertia */}
      <main
        className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8 lg:pl-56"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {route === "dashboard" && <Dashboard />}
        {route === "modules" && <Modules />}
        {route === "street" && <StreetScreen />}
        {route === "review" && <ReviewCenter />}
        {route === "library" && <Library />}
        {route === "conversations" && <Conversations />}
        {route === "history" && <History />}
        {route === "settings" && <Settings />}
      </main>

      {/* mobile bottom nav with safe-area padding for home swipe bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md lg:hidden dark:border-nline dark:bg-carbon/95">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <MobileTab active={route === "dashboard"} onClick={() => nav("dashboard")} icon={<LayoutDashboard size={19} />} label="Today" />
          <MobileTab active={route === "modules"} onClick={() => nav("modules")} icon={<BookOpen size={19} />} label="Modules" />
          <button
            onClick={quickPractice}
            className="btn-press focus-ring -mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine-600 text-white shadow-pop hover:bg-pine-700"
            aria-label="Start practice"
          >
            <Play size={22} className="ml-0.5" />
          </button>
          <MobileTab active={route === "library"} onClick={() => nav("library")} icon={<LibraryBig size={19} />} label="Library" />
          <button onClick={() => setSheet(true)} className="btn-press focus-ring flex flex-col items-center gap-0.5 px-3 py-1 text-faint" aria-label="More">
            <Menu size={19} />
            <span className="text-[9px] font-bold uppercase tracking-wide">More</span>
          </button>
        </div>
      </nav>

      {/* mobile more-sheet */}
      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/50 backdrop-blur-[2px] lg:hidden dark:bg-black/60" onClick={() => setSheet(false)}>
          <div className="anim-rise w-full rounded-t-3xl border-t border-line bg-panel p-5 pb-[max(2rem,calc(1.5rem+env(safe-area-inset-bottom,0px)))] dark:border-nline dark:bg-carbon" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line dark:bg-nline" />
            <div className="grid grid-cols-2 gap-2">
              {NAV.filter((n) => !["dashboard", "modules", "library"].includes(n.id)).map((n) => (
                <button key={n.id} onClick={() => { setSheet(false); nav(n.id); }}
                  className={cx("btn-press focus-ring flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-semibold",
                    route === n.id ? "border-pine-500 bg-pine-50 text-pine-700 dark:bg-pine-900/40 dark:text-pine-300" : "border-line text-mute dark:border-nline dark:text-faint")}>
                  {n.icon} {n.label}
                </button>
              ))}
            </div>
            <button onClick={() => setSheet(false)} className="btn-press focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-faint">
              <X size={15} /> Close
            </button>
          </div>
        </div>
      )}

      <AiTutor />
      {practice && <PracticeScreen />}
      <ToastHost toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

function MobileTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={cx("btn-press focus-ring flex flex-col items-center gap-0.5 px-3 py-1", active ? "text-pine-600 dark:text-pine-300" : "text-faint")}>
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

function ToastHost({ toasts, dismiss }: { toasts: { id: number; msg: string; tone: string }[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cx("anim-pop pointer-events-auto rounded-xl border px-4 py-3 text-left text-sm font-semibold shadow-pop",
            t.tone === "clay" ? "border-clay-400/50 bg-clay-100 text-clay-600 dark:border-clay-500/40 dark:bg-clay-500/15 dark:text-clay-400"
              : t.tone === "gold" ? "border-gold-300 bg-gold-100 text-gold-600 dark:border-gold-400/40 dark:bg-gold-400/15 dark:text-gold-300"
                : "border-pine-200 bg-panel text-pine-800 dark:border-pine-800 dark:bg-carbon dark:text-pine-200")}
        >
          {t.msg}
        </button>
      ))}
    </div>
  );
}

function dueNow(data: ReturnType<typeof useApp>["data"]): number {
  const now = Date.now();
  return Object.values(data.progress).filter((p) => p.nextReview !== undefined && p.nextReview <= now && p.mastery >= 20).length;
}

function allPhrasesMemo(custom: Phrase[]): Phrase[] {
  return [...PHRASES, ...custom];
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
