import type { Attempt, DailyLog, PhraseProgress, Settings, StudySession, UserAccount, UserData } from "./types";
import { PHRASES } from "./data";
import { DAY_MS, dateKeyOffset, todayKey, yesterdayKey } from "./engine";

/* ============================================================
   LOCAL-FIRST DATA LAYER
   A real deployment would swap these functions for server
   routes + Postgres (schema is mirrored in types.ts). The app
   only talks to this module, so the swap is contained.
   ============================================================ */

const USERS_KEY = "fluencia.users";
const SESSION_KEY = "fluencia.session";
const dataKey = (uid: string) => `fluencia.data.${uid}`;

export function defaultSettings(): Settings {
  return {
    dailyGoalMinutes: 10,
    newPerDay: 6,
    focus: "balanced",
    level: "intermediate",
    audioAutoplay: true,
    audioRate: "normal",
    speakingEnabled: true,
    darkMode: false,
  };
}

export function emptyData(settings?: Partial<Settings>): UserData {
  return {
    version: 1,
    onboarded: false,
    settings: { ...defaultSettings(), ...(settings ?? {}) },
    progress: {},
    history: [],
    attempts: [],
    achievements: {},
    favorites: [],
    notes: {},
    reported: [],
    paused: [],
    lessonsDone: [],
    moduleTests: {},
    customPhrases: [],
    conversationBest: {},
    dailyLog: {},
    streak: { current: 0, best: 0, last: "" },
    totalXp: 0,
  };
}

/* ---------------- hashing ---------------- */

export async function hashPassword(pw: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`fluencia::${pw}`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // non-secure-context fallback (demo only)
    let h = 5381;
    const s = `fluencia::${pw}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return `djb2:${(h >>> 0).toString(16)}`;
  }
}

/* ---------------- users ---------------- */

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full — ignore */
  }
}

export function getUsers(): UserAccount[] {
  return readJSON<UserAccount[]>(USERS_KEY, []);
}
function saveUsers(users: UserAccount[]) {
  writeJSON(USERS_KEY, users);
}

export async function registerUser(name: string, email: string, password: string): Promise<{ ok: true; user: UserAccount } | { ok: false; error: string }> {
  const users = getUsers();
  const em = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (users.some((u) => u.email === em)) return { ok: false, error: "An account with this email already exists." };
  const user: UserAccount = {
    id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || em.split("@")[0],
    email: em,
    passHash: await hashPassword(password),
    createdAt: Date.now(),
  };
  saveUsers([...users, user]);
  writeJSON(dataKey(user.id), emptyData());
  setSession(user.id);
  return { ok: true, user };
}

export async function loginUser(email: string, password: string): Promise<{ ok: true; user: UserAccount } | { ok: false; error: string }> {
  const em = email.trim().toLowerCase();
  const user = getUsers().find((u) => u.email === em);
  if (!user) return { ok: false, error: "No account found with this email." };
  const h = await hashPassword(password);
  if (h !== user.passHash) return { ok: false, error: "Incorrect password. Try again." };
  setSession(user.id);
  return { ok: true, user };
}

export function findOrCreateDemo(): UserAccount {
  const users = getUsers();
  let demo = users.find((u) => u.demo);
  if (!demo) {
    demo = {
      id: "u_demo",
      name: "Demo Learner",
      email: "demo@fluencia.app",
      passHash: "demo",
      createdAt: Date.now() - 45 * DAY_MS,
      demo: true,
    };
    saveUsers([...users, demo]);
    writeJSON(dataKey(demo.id), makeDemoData());
  }
  setSession(demo.id);
  return demo;
}

export function getSessionUserId(): string | null {
  return readJSON<{ userId?: string }>(SESSION_KEY, {}).userId ?? null;
}
export function setSession(userId: string | null) {
  const cur = readJSON<{ theme?: string }>(SESSION_KEY, {});
  writeJSON(SESSION_KEY, { ...cur, userId });
}
export function persistTheme(theme: "light" | "dark") {
  const cur = readJSON<{ userId?: string }>(SESSION_KEY, {});
  writeJSON(SESSION_KEY, { ...cur, theme });
}

/* ---------------- user data ---------------- */

export function loadUserData(userId: string): UserData {
  const d = readJSON<UserData | null>(dataKey(userId), null);
  if (!d) {
    const fresh = emptyData();
    writeJSON(dataKey(userId), fresh);
    return fresh;
  }
  return { ...emptyData(), ...d };
}

export function saveUserData(userId: string, data: UserData) {
  writeJSON(dataKey(userId), data);
}

export function deleteUserData(userId: string) {
  try {
    localStorage.removeItem(dataKey(userId));
  } catch {
    /* noop */
  }
  writeJSON(dataKey(userId), emptyData());
}

/* ---------------- deterministic PRNG for the demo seed ---------------- */

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- demo seed ----------------
   Real sign-ups start clean. The demo account ships with a
   realistic spread of states so every surface can be explored:
   long-term, mastered, strong, reviewing, due, weak, fresh, new. */

export function makeDemoData(): UserData {
  const now = Date.now();
  const rnd = mulberry(20260214);
  const data = emptyData();
  data.onboarded = true;
  data.settings = { ...defaultSettings(), dailyGoalMinutes: 10, focus: "balanced" };

  const ids = PHRASES.map((p) => p.id);
  const set = (id: string, p: Partial<PhraseProgress>) => {
    data.progress[id] = {
      mastery: 0, interval: 0, ease: 2.3, reps: 0, lapses: 0, consec: 0,
      timesSeen: 0, correct: 0, incorrect: 0, exTypes: {}, ...p,
    };
  };

  ids.forEach((id, i) => {
    const seen = 6 + Math.floor(rnd() * 8);
    if (i < 2) {
      // long-term mastered
      const first = now - 55 * DAY_MS;
      set(id, {
        mastery: 92 + rnd() * 6, interval: 60, ease: 2.6, reps: seen + 6, consec: 6,
        timesSeen: seen + 8, correct: seen + 7, incorrect: 1, firstLearned: first,
        lastReviewed: now - 9 * DAY_MS, nextReview: now + 40 * DAY_MS,
        masteredAt: now - 30 * DAY_MS, longTermAt: now - 8 * DAY_MS, lastIntervalDays: 30,
        exTypes: { en_es: 2, es_en: 3, dictation: 2, speaking: 1, context_gen: 1 },
      });
    } else if (i < 14) {
      // mastered
      const m = 76 + rnd() * 12;
      const last = now - (2 + rnd() * 6) * DAY_MS;
      set(id, {
        mastery: m, interval: 14, ease: 2.4 + rnd() * 0.3, reps: seen + 2, consec: 3 + Math.floor(rnd() * 3),
        timesSeen: seen + 3, correct: seen + 2, incorrect: 1 + Math.floor(rnd() * 2),
        firstLearned: now - (25 + rnd() * 20) * DAY_MS, lastReviewed: last,
        nextReview: now + (i % 3 === 0 ? -0.5 : 5 + rnd() * 8) * DAY_MS,
        masteredAt: now - (5 + rnd() * 10) * DAY_MS, lastIntervalDays: 7,
        exTypes: { en_es: 2, es_en: 2, dictation: 1, fill: 1 },
      });
    } else if (i < 24) {
      // strong
      set(id, {
        mastery: 60 + rnd() * 13, interval: 7, ease: 2.3, reps: seen, consec: 2,
        timesSeen: seen, correct: seen - 1, incorrect: 1,
        firstLearned: now - (10 + rnd() * 12) * DAY_MS, lastReviewed: now - (1 + rnd() * 3) * DAY_MS,
        nextReview: now + (2 + rnd() * 5) * DAY_MS, lastIntervalDays: 3,
        exTypes: { en_es: 2, fill: 1, es_en: 1 },
      });
    } else if (i < 34) {
      // reviewing — half overdue
      const overdue = i % 2 === 0;
      set(id, {
        mastery: 40 + rnd() * 18, interval: 3, ease: 2.2, reps: seen - 2, consec: 1,
        timesSeen: seen - 1, correct: seen - 3, incorrect: 2,
        firstLearned: now - (6 + rnd() * 8) * DAY_MS, lastReviewed: now - (overdue ? 4 + rnd() * 3 : 0.5) * DAY_MS,
        nextReview: overdue ? now - (0.3 + rnd() * 2) * DAY_MS : now + (1 + rnd() * 2) * DAY_MS,
        lastIntervalDays: 2, exTypes: { en_es: 2, rebuild: 1 },
      });
    } else if (i < 42) {
      // learning / struggling
      const struggling = i < 37;
      set(id, {
        mastery: struggling ? 14 + rnd() * 12 : 22 + rnd() * 14,
        interval: struggling ? MIN10_DEMO : 1, ease: struggling ? 1.6 : 2.0,
        reps: 3, consec: 0, timesSeen: 5, correct: 2, incorrect: struggling ? 3 : 2,
        lapses: struggling ? 2 + Math.floor(rnd() * 2) : 1,
        firstLearned: now - (3 + rnd() * 4) * DAY_MS, lastReviewed: now - 0.4 * DAY_MS,
        nextReview: now - 0.1 * DAY_MS, lastIntervalDays: 0.5, exTypes: { en_es: 1, fill: 1 },
      });
    } else if (i < 48) {
      // fresh — learned yesterday
      set(id, {
        mastery: 24 + rnd() * 18, interval: 1, ease: 2.2, reps: 2, consec: 1,
        timesSeen: 3, correct: 2, incorrect: 1,
        firstLearned: now - 1.1 * DAY_MS, lastReviewed: now - 0.9 * DAY_MS,
        nextReview: now + 0.2 * DAY_MS, lastIntervalDays: 1, exTypes: { en_es: 1, es_en: 1 },
      });
    }
    // the rest stay NEW (no progress entry)
  });

  /* history: ~2 weeks of sessions, current 9-day streak */
  const exTypes = ["en_es", "es_en", "fill", "dictation", "rebuild", "meaning", "context", "context_gen"] as const;
  let totalXp = 0;
  for (let d = 13; d >= 1; d--) {
    if (d === 4) continue; // one missed day before the streak
    const sessions = rnd() > 0.7 ? 2 : 1;
    for (let s = 0; s < sessions; s++) {
      const exercises = 8 + Math.floor(rnd() * 10);
      const correct = Math.floor(exercises * (0.62 + rnd() * 0.3));
      const alt = Math.floor((exercises - correct) * 0.4);
      const incorrect = exercises - correct - alt;
      const xp = correct * 9 + alt * 6 + incorrect * 2;
      totalXp += xp;
      const minutes = Math.round(exercises * 0.7);
      const date = now - d * DAY_MS - Math.floor(rnd() * 8) * 3_600_000;
      const k = dateKeyOffset(d);
      data.history.push({
        id: `h_${d}_${s}`, date, dateKey: k, minutes, exercises, correct, incorrect, alt, xp,
        newLearned: d > 10 ? [ids[40 + d]] : [], strengthened: [], mastered: d === 6 ? [ids[10]] : [],
        weakened: [], mode: rnd() > 0.75 ? "review" : "daily",
      });
      const log = (data.dailyLog[k] = data.dailyLog[k] ?? { xp: 0, minutes: 0, exercises: 0, correct: 0, incorrect: 0, newLearned: 0 });
      log.xp += xp; log.minutes += minutes; log.exercises += exercises; log.correct += correct; log.incorrect += incorrect;
      log.newLearned += d > 10 ? 1 : 0;
    }
  }
  // today: a short morning session already logged (so charts show today)
  const tk = todayKey(now);
  data.history.push({
    id: "h_today", date: now - 2 * 3_600_000, dateKey: tk, minutes: 6, exercises: 7, correct: 6,
    incorrect: 1, alt: 0, xp: 62, newLearned: [], strengthened: [ids[20]], mastered: [], weakened: [], mode: "daily",
  });
  data.dailyLog[tk] = { xp: 62, minutes: 6, exercises: 7, correct: 6, incorrect: 1, newLearned: 0 };
  totalXp += 62;
  data.totalXp = totalXp;
  data.streak = { current: 9, best: 12, last: tk };

  /* attempts feed (for accuracy charts) */
  const domains = PHRASES.map((p) => p.domain);
  for (let i = 0; i < 220; i++) {
    const pi = Math.floor(rnd() * ids.length);
    const result = rnd() < 0.72 ? "correct" : rnd() < 0.5 ? "alt" : "incorrect";
    const a: Attempt = {
      t: now - Math.floor(rnd() * 13) * DAY_MS - Math.floor(rnd() * 8) * 3_600_000,
      phraseId: ids[pi],
      ex: exTypes[Math.floor(rnd() * exTypes.length)],
      result: result as Attempt["result"],
      domain: domains[pi],
    };
    data.attempts.push(a);
  }
  data.attempts.sort((a, b) => a.t - b.t);

  data.lessonsDone = ["m1-l1", "m1-l2", "m2-l1", "m2-l2", "m3-l1"];
  data.moduleTests = {
    1: { score: 92, passed: true, date: now - 21 * DAY_MS },
    2: { score: 84, passed: true, date: now - 12 * DAY_MS },
  };
  data.favorites = ["p13", "p37", "p43"];
  data.notes = { p13: "Say this at work every day — it sounds confident." };
  data.achievements = {
    "first-session": new Date(now - 13 * DAY_MS).toISOString(),
    "streak-3": new Date(now - 11 * DAY_MS).toISOString(),
    "streak-7": new Date(now - 2 * DAY_MS).toISOString(),
    "mastered-10": new Date(now - 5 * DAY_MS).toISOString(),
  };
  data.conversationBest = { "cv-checkin": 83 };
  return data;
}

const MIN10_DEMO = 10 / (24 * 60);

export { yesterdayKey };
