import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  Attempt, ExType, Phrase, RouteId, SessionConfig, SessionSummary, Settings,
  StudySession, UserAccount, UserData, Verdict,
} from "./lib/types";
import {
  allPhrases, checkAchievements, freshProgress, gradeExercise, todayKey, xpFor,
} from "./lib/engine";
import {
  deleteUserData, findOrCreateDemo, getSessionUserId, loadUserData, loginUser, persistTheme,
  registerUser, saveUserData, setSession,
} from "./lib/db";

export interface Toast { id: number; msg: string; tone: "pine" | "gold" | "clay" | "ink" }

interface AppCtx {
  user: UserAccount | null;
  data: UserData;
  phrases: Phrase[];
  route: RouteId;
  nav: (r: RouteId) => void;
  practice: SessionConfig | null;
  startPractice: (c: SessionConfig) => void;
  closePractice: () => void;
  toasts: Toast[];
  toast: (msg: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  booting: boolean;

  login: (email: string, pw: string) => Promise<string | null>;
  register: (name: string, email: string, pw: string) => Promise<string | null>;
  demoLogin: () => void;
  logout: () => void;

  recordExercise: (phraseId: string, ex: ExType, verdict: Verdict) => { delta: number; delayedBonus: boolean };
  recordSession: (summary: SessionSummary, mode: StudySession["mode"], metaId?: string) => string[];
  completeLesson: (id: string) => void;
  setModuleTest: (moduleId: number, score: number, passed: boolean) => void;
  toggleFavorite: (id: string) => void;
  setNote: (id: string, text: string) => void;
  resetPhrase: (id: string) => void;
  togglePause: (id: string) => void;
  reportPhrase: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  finishOnboarding: (patch: Partial<Settings>, diagnostic: { phraseId: string; verdict: Verdict }[]) => void;
  importContent: (raw: string) => { ok: boolean; count?: number; error?: string };
  conversationScore: (id: string, score: number) => void;
  exportData: () => string;
  wipeProgress: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

let toastSeq = 1;

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [data, setData] = useState<UserData | null>(null);
  const [route, setRoute] = useState<RouteId>("dashboard");
  const [practice, setPractice] = useState<SessionConfig | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [booting, setBooting] = useState(true);
  const dataRef = useRef<UserData | null>(null);

  useEffect(() => {
    const uid = getSessionUserId();
    if (uid) {
      const u = loadUserData(uid);
      let users: UserAccount[] = [];
      try { users = JSON.parse(localStorage.getItem("fluencia.users") ?? "[]") as UserAccount[]; } catch { users = []; }
      const acct = users.find((x) => x.id === uid) ?? null;
      if (acct) {
        setUser(acct);
        setData(u);
        dataRef.current = u;
      }
    }
    const t = setTimeout(() => setBooting(false), 250);
    return () => clearTimeout(t);
  }, []);

  // persist on change
  useEffect(() => {
    if (user && data) saveUserData(user.id, data);
  }, [user, data]);

  // dark mode side-effect
  useEffect(() => {
    const dark = data?.settings.darkMode ?? false;
    document.documentElement.classList.toggle("dark", dark);
    persistTheme(dark ? "dark" : "light");
  }, [data?.settings.darkMode]);

  const mutate = useCallback((fn: (d: UserData) => UserData) => {
    setData((d) => {
      if (!d) return d;
      const next = fn(d);
      dataRef.current = next;
      return next;
    });
  }, []);

  const toast = useCallback((msg: string, tone: Toast["tone"] = "pine") => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const phrases = useMemo(() => allPhrases(data?.customPhrases ?? []), [data?.customPhrases]);

  /* ---------------- auth ---------------- */

  const login = useCallback(async (email: string, pw: string) => {
    const r = await loginUser(email, pw);
    if (!r.ok) return r.error;
    setUser(r.user);
    const d = loadUserData(r.user.id);
    setData(d); dataRef.current = d;
    setRoute("dashboard");
    return null;
  }, []);

  const register = useCallback(async (name: string, email: string, pw: string) => {
    const r = await registerUser(name, email, pw);
    if (!r.ok) return r.error;
    setUser(r.user);
    const d = loadUserData(r.user.id);
    setData(d); dataRef.current = d;
    setRoute("dashboard");
    return null;
  }, []);

  const demoLogin = useCallback(() => {
    const u = findOrCreateDemo();
    setUser(u);
    const d = loadUserData(u.id);
    setData(d); dataRef.current = d;
    setRoute("dashboard");
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setUser(null);
    setData(null);
    dataRef.current = null;
    setPractice(null);
    setRoute("dashboard");
  }, []);

  /* ---------------- learning mutations ---------------- */

  const recordExercise = useCallback((phraseId: string, ex: ExType, verdict: Verdict) => {
    const now = Date.now();
    const d = dataRef.current!;
    const phrase = allPhrases(d.customPhrases).find((p) => p.id === phraseId);
    const prev = d.progress[phraseId];
    const { p, delta, delayedBonus } = gradeExercise(prev, ex, verdict, now);
    const isNew = !prev || prev.timesSeen === 0;
    const attempt: Attempt = { t: now, phraseId, ex, result: verdict, domain: phrase?.domain ?? "everyday" };
    const tk = todayKey(now);
    mutate((cur) => {
      const log = { ...(cur.dailyLog[tk] ?? { xp: 0, minutes: 0, exercises: 0, correct: 0, incorrect: 0, newLearned: 0 }) };
      log.xp += xpFor(ex, verdict);
      log.exercises += 1;
      if (verdict === "incorrect") log.incorrect += 1;
      else log.correct += 1;
      if (isNew) log.newLearned += 1;
      return {
        ...cur,
        progress: { ...cur.progress, [phraseId]: p },
        attempts: [...cur.attempts.slice(-599), attempt],
        dailyLog: { ...cur.dailyLog, [tk]: log },
        totalXp: cur.totalXp + xpFor(ex, verdict),
      };
    });
    return { delta, delayedBonus };
  }, [mutate]);

  const recordSession = useCallback((summary: SessionSummary, mode: StudySession["mode"], metaId?: string) => {
    const now = Date.now();
    const tk = todayKey(now);
    const session: StudySession = {
      id: `s_${now.toString(36)}`,
      date: now, dateKey: tk,
      minutes: Math.max(1, Math.round(summary.seconds / 60)),
      exercises: summary.exercises, correct: summary.correct, incorrect: summary.incorrect, alt: summary.alt,
      xp: summary.xp, newLearned: summary.newLearned, strengthened: summary.strengthened,
      mastered: summary.mastered, weakened: summary.weakened, mode,
    };
    const unlocked: string[] = [];
    mutate((cur) => {
      const prev = cur.streak;
      let current = prev.current;
      if (prev.last !== tk) {
        const yd = todayKey(now - 86_400_000);
        current = prev.last === yd ? prev.current + 1 : 1;
      }
      const log = { ...(cur.dailyLog[tk] ?? { xp: 0, minutes: 0, exercises: 0, correct: 0, incorrect: 0, newLearned: 0 }) };
      log.minutes += session.minutes;
      // practice modes already banked XP per exercise; conversation XP is banked here
      const bankXp = mode === "conversation" ? session.xp : 0;
      log.xp += bankXp;
      const next: UserData = {
        ...cur,
        history: [...cur.history, session],
        dailyLog: { ...cur.dailyLog, [tk]: log },
        totalXp: cur.totalXp + bankXp,
        streak: { current, best: Math.max(prev.best, current), last: tk },
        achievements: { ...cur.achievements },
      };
      unlocked.push(...checkAchievements(next, allPhrases(next.customPhrases)));
      for (const id of unlocked) next.achievements[id] = new Date(now).toISOString();
      return next;
    });
    void metaId;
    return unlocked;
  }, [mutate]);

  const completeLesson = useCallback((id: string) => {
    mutate((cur) => (cur.lessonsDone.includes(id) ? cur : { ...cur, lessonsDone: [...cur.lessonsDone, id] }));
  }, [mutate]);

  const setModuleTest = useCallback((moduleId: number, score: number, passed: boolean) => {
    mutate((cur) => ({ ...cur, moduleTests: { ...cur.moduleTests, [moduleId]: { score, passed, date: Date.now() } } }));
  }, [mutate]);

  const toggleFavorite = useCallback((id: string) => {
    mutate((cur) => ({
      ...cur,
      favorites: cur.favorites.includes(id) ? cur.favorites.filter((x) => x !== id) : [...cur.favorites, id],
    }));
  }, [mutate]);

  const setNote = useCallback((id: string, text: string) => {
    mutate((cur) => {
      const notes = { ...cur.notes };
      if (text.trim()) notes[id] = text;
      else delete notes[id];
      return { ...cur, notes };
    });
  }, [mutate]);

  const resetPhrase = useCallback((id: string) => {
    mutate((cur) => ({ ...cur, progress: { ...cur.progress, [id]: freshProgress() } }));
  }, [mutate]);

  const togglePause = useCallback((id: string) => {
    mutate((cur) => ({
      ...cur,
      paused: cur.paused.includes(id) ? cur.paused.filter((x) => x !== id) : [...cur.paused, id],
    }));
  }, [mutate]);

  const reportPhrase = useCallback((id: string) => {
    mutate((cur) => (cur.reported.includes(id) ? cur : { ...cur, reported: [...cur.reported, id] }));
  }, [mutate]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    mutate((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
  }, [mutate]);

  const finishOnboarding = useCallback((patch: Partial<Settings>, diagnostic: { phraseId: string; verdict: Verdict }[]) => {
    const now = Date.now();
    mutate((cur) => {
      const progress = { ...cur.progress };
      const attempts = [...cur.attempts];
      for (const d of diagnostic) {
        const { p } = gradeExercise(progress[d.phraseId], "en_es", d.verdict, now);
        progress[d.phraseId] = p;
        const phrase = allPhrases(cur.customPhrases).find((x) => x.id === d.phraseId);
        attempts.push({ t: now, phraseId: d.phraseId, ex: "en_es", result: d.verdict, domain: phrase?.domain ?? "everyday" });
      }
      return { ...cur, onboarded: true, settings: { ...cur.settings, ...patch }, progress, attempts: attempts.slice(-600) };
    });
  }, [mutate]);

  const importContent = useCallback((raw: string): { ok: boolean; count?: number; error?: string } => {
    try {
      let items: Partial<Phrase>[] = [];
      const trimmed = raw.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
        const header = lines[0].toLowerCase();
        const sep = header.includes(";") ? ";" : header.includes("\t") ? "\t" : ",";
        const cols = lines[0].split(sep).map((c) => c.trim().toLowerCase().replace(/"/g, ""));
        for (const line of lines.slice(1)) {
          const vals = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};
          cols.forEach((c, i) => (row[c] = vals[i] ?? ""));
          items.push({
            en: row.en ?? row.english ?? row.phrase,
            es: row.es ?? row.spanish ?? row.translation,
            module: Number(row.module ?? 1),
            category: row.category ?? "Imported",
            subcategory: row.subcategory ?? "Imported",
            domain: (row.domain === "medical" ? "medical" : "everyday"),
          });
        }
      }
      const valid = items.filter((i) => i.en && i.es) as Phrase[];
      if (!valid.length) return { ok: false, error: "No valid phrases found. Each needs at least en + es." };
      mutate((cur) => {
        const base = Date.now().toString(36);
        const added: Phrase[] = valid.map((v, i) => ({
          id: `x_${base}_${i}`,
          module: Number(v.module) || 11,
          category: v.category || "Imported",
          subcategory: v.subcategory || "Imported",
          domain: v.domain === "medical" ? "medical" : "everyday",
          en: v.en, es: v.es,
          alt: v.alt || v.es,
          explain: v.explain || "Imported phrase.",
          grammar: v.grammar || "—",
          difficulty: (Number(v.difficulty) as 1 | 2 | 3) || 1,
          tags: Array.isArray(v.tags) ? v.tags : String(v.tags ?? "imported").split("|"),
          example: v.example || v.en,
          scenario: v.scenario || "A conversation where this phrase fits naturally.",
          concepts: [[v.en.toLowerCase().replace(/[.,!?]/g, "")]],
          custom: true,
        }));
        return { ...cur, customPhrases: [...cur.customPhrases, ...added] };
      });
      return { ok: true, count: valid.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Could not parse the content." };
    }
  }, [mutate]);

  const conversationScore = useCallback((id: string, score: number) => {
    mutate((cur) => ({
      ...cur,
      conversationBest: { ...cur.conversationBest, [id]: Math.max(cur.conversationBest[id] ?? 0, score) },
    }));
  }, [mutate]);

  const exportData = useCallback(() => JSON.stringify(dataRef.current, null, 2), []);

  const wipeProgress = useCallback(() => {
    if (user) {
      deleteUserData(user.id);
      const d = loadUserData(user.id);
      d.onboarded = dataRef.current?.onboarded ?? true;
      setData(d); dataRef.current = d;
    }
  }, [user]);

  const value: AppCtx = {
    user,
    data: data ?? (emptyDataFallback()),
    phrases,
    route,
    nav: (r) => setRoute(r),
    practice,
    startPractice: (c) => setPractice(c),
    closePractice: () => setPractice(null),
    toasts, toast, dismissToast,
    booting,
    login, register, demoLogin, logout,
    recordExercise, recordSession, completeLesson, setModuleTest,
    toggleFavorite, setNote, resetPhrase, togglePause, reportPhrase,
    updateSettings, finishOnboarding, importContent, conversationScore, exportData, wipeProgress,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function emptyDataFallback(): UserData {
  return {
    version: 1, onboarded: false,
    settings: { dailyGoalMinutes: 10, newPerDay: 6, focus: "balanced", level: "intermediate", audioAutoplay: true, audioRate: "normal", speakingEnabled: true, darkMode: false },
    progress: {}, history: [], attempts: [], achievements: {}, favorites: [], notes: {},
    reported: [], paused: [], lessonsDone: [], moduleTests: {}, customPhrases: [],
    conversationBest: {}, dailyLog: {}, streak: { current: 0, best: 0, last: "" }, totalXp: 0,
  };
}


