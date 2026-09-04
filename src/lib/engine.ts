import type {
  Attempt, Domain, ExType, Phrase, PhraseProgress, PhraseState, PlannedItem,
  SessionConfig, Settings, UserData, Verdict,
} from "./types";
import { MODULES, PHRASES } from "./data";

/* ============================================================
   LEARNING ENGINE
   - SM-2-inspired spaced repetition with a 0–100 mastery score
   - Exercise-type weighting (production > recognition)
   - Delayed-recall verification for long-term mastery
   - Smart session generation (overdue / weak / fresh / new)
   - Fuzzy answer evaluation + tutor-style feedback
   ============================================================ */

export const DAY_MS = 86_400_000;
export const MIN10 = 10 / (24 * 60); // 10 minutes in days

export function todayKey(t = Date.now()): string {
  return new Date(t).toLocaleDateString("en-CA");
}
export function yesterdayKey(): string {
  return todayKey(Date.now() - DAY_MS);
}
export function dateKeyOffset(days: number): string {
  return todayKey(Date.now() - days * DAY_MS);
}

const WEIGHT: Record<ExType, number> = {
  en_es: 6, meaning: 6, context: 7, fill: 8, rebuild: 9, listen: 8,
  dictation: 10, es_en: 12, speaking: 12, context_gen: 14, conversation: 14,
};

export function freshProgress(): PhraseProgress {
  return {
    mastery: 0, interval: 0, ease: 2.3, reps: 0, lapses: 0, consec: 0,
    timesSeen: 0, correct: 0, incorrect: 0, exTypes: {},
  };
}

/* Interval ladder (days). Index chosen by mastery band. */
const LADDER = [MIN10, 1, 2, 3, 7, 14, 30, 60, 90];
function ladderIndex(mastery: number): number {
  if (mastery < 20) return 0;
  if (mastery < 30) return 1;
  if (mastery < 40) return 2;
  if (mastery < 50) return 3;
  if (mastery < 60) return 4;
  if (mastery < 70) return 5;
  if (mastery < 80) return 6;
  if (mastery < 90) return 7;
  return 8;
}

export interface GradeResult {
  p: PhraseProgress;
  delta: number; // mastery change (can be negative)
  delayedBonus: boolean;
}

export function gradeExercise(
  prev: PhraseProgress | undefined,
  ex: ExType,
  verdict: Verdict,
  now: number,
): GradeResult {
  const p: PhraseProgress = prev ? { ...prev, exTypes: { ...prev.exTypes } } : freshProgress();
  const w = WEIGHT[ex] ?? 8;
  const overdueDays = p.nextReview && p.lastReviewed ? (now - p.nextReview) / DAY_MS : 0;
  const delayedBonus = verdict !== "incorrect" && p.interval >= 1 && overdueDays > p.interval * 0.4;

  let delta = 0;
  if (verdict === "incorrect") {
    const loss = Math.max(7, p.mastery * 0.16);
    delta = -Math.min(loss, Math.max(0, p.mastery - 4));
    p.mastery = Math.max(4, p.mastery - loss);
    p.ease = Math.max(1.3, p.ease - 0.15);
    p.consec = 0;
    p.lapses += 1;
    p.incorrect += 1;
    p.interval = MIN10; // re-learn step: again in ~10 minutes
    if (p.mastery < 90) p.longTermAt = undefined;
  } else {
    const easeAdj = 0.75 + (0.25 * Math.min(p.ease - 1.3, 1.5)) / 1.5; // 0.75 – 1.0
    const altFactor = verdict === "alt" ? 0.7 : 1;
    const bonus = delayedBonus ? 1.25 : 1;
    delta = w * easeAdj * altFactor * bonus;
    p.mastery = Math.min(100, p.mastery + delta);
    p.ease = Math.min(2.8, p.ease + 0.06);
    p.consec += 1;
    p.correct += 1;
    p.reps += 1;
    p.exTypes[ex] = (p.exTypes[ex] ?? 0) + 1;

    // Interval: climb the ladder but never jump more than ~2.6x at once
    const target = LADDER[ladderIndex(p.mastery)];
    p.interval = Math.min(target, Math.max(target === MIN10 ? MIN10 : 1, p.interval * 2.6));
    if (p.interval > target) p.interval = target;
    p.lastIntervalDays = p.interval;

    if (p.mastery >= 75 && !p.masteredAt) p.masteredAt = now;
    if (p.mastery < 75) p.masteredAt = undefined;

    // Long-term mastery requires real elapsed time + cleared delayed reviews
    const age = p.firstLearned ? now - p.firstLearned : 0;
    const clearedDelayed = (p.interval >= 7 && p.reps >= 3) || (p.lastIntervalDays ?? 0) >= 7;
    if (p.mastery >= 90 && age >= 14 * DAY_MS && clearedDelayed) {
      if (!p.longTermAt) p.longTermAt = now;
    } else if (p.mastery < 90) {
      p.longTermAt = undefined;
    }
  }

  p.timesSeen += 1;
  p.lastReviewed = now;
  p.nextReview = now + p.interval * DAY_MS;
  p.firstLearned = p.firstLearned ?? now;
  p.lastExType = ex;
  p.lastResult = verdict;
  return { p, delta: Math.round(delta * 10) / 10, delayedBonus };
}

/* ---------------- Display state ---------------- */

export function getState(p: PhraseProgress | undefined, now = Date.now()): PhraseState {
  if (!p || p.timesSeen === 0) return "NEW";
  if (p.lapses >= 2 && p.mastery < 60) return "STRUGGLING";
  const overdue = p.nextReview !== undefined && p.nextReview <= now;
  if (p.mastery >= 90 && p.longTermAt) return "LONG_TERM_MASTERED";
  if (p.mastery >= 75) return overdue ? "NEEDS_REVIEW" : "MASTERED";
  if (overdue && p.mastery >= 20) return "NEEDS_REVIEW";
  if (p.mastery >= 60) return "STRONG";
  if (p.mastery >= 40) return "REVIEWING";
  return "LEARNING";
}

export const STATE_ORDER: PhraseState[] = [
  "NEW", "LEARNING", "REVIEWING", "STRUGGLING", "NEEDS_REVIEW", "STRONG", "MASTERED", "LONG_TERM_MASTERED",
];

export function masteryBand(m: number): PhraseState {
  if (m >= 90) return "LONG_TERM_MASTERED";
  if (m >= 75) return "MASTERED";
  if (m >= 60) return "STRONG";
  if (m >= 40) return "REVIEWING";
  if (m >= 20) return "LEARNING";
  return "NEW";
}

export function bandRank(s: PhraseState): number {
  const map: Record<string, number> = {
    NEW: 0, LEARNING: 1, REVIEWING: 2, STRUGGLING: 1, NEEDS_REVIEW: 2,
    STRONG: 3, MASTERED: 4, LONG_TERM_MASTERED: 5,
  };
  return map[s] ?? 0;
}

export function dueCount(progress: Record<string, PhraseProgress>, now = Date.now()): number {
  return Object.values(progress).filter(
    (p) => p.nextReview !== undefined && p.nextReview <= now && p.mastery >= 20,
  ).length;
}

/* ---------------- Answer evaluation ---------------- */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, (m) => (m === "’" ? "'" : m))
    .replace(/i'm/g, "i am").replace(/i'll/g, "i will").replace(/i've/g, "i have")
    .replace(/can't/g, "cannot").replace(/won't/g, "will not").replace(/don't/g, "do not")
    .replace(/doesn't/g, "does not").replace(/didn't/g, "did not").replace(/isn't/g, "is not")
    .replace(/aren't/g, "are not").replace(/wasn't/g, "was not").replace(/weren't/g, "were not")
    .replace(/haven't/g, "have not").replace(/hasn't/g, "has not").replace(/hadn't/g, "had not")
    .replace(/you're/g, "you are").replace(/it's/g, "it is").replace(/that's/g, "that is")
    .replace(/what's/g, "what is").replace(/how's/g, "how is").replace(/let's/g, "let us")
    .replace(/we're/g, "we are").replace(/they're/g, "they are").replace(/there's/g, "there is")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

function sim(a: string, b: string): number {
  const m = Math.max(a.length, b.length);
  return m === 0 ? 1 : 1 - lev(a, b) / m;
}

function containsAny(haystack: string, groups: string[][]): boolean {
  return groups.every((g) => g.some((opt) => haystack.includes(normalize(opt))));
}

export interface TypeVerdict {
  verdict: Verdict;
  matched?: string; // which acceptable answer matched
  diffWord?: string; // first divergent word (for hints)
}

export function evaluateTyped(expected: string, alts: string[], input: string): TypeVerdict {
  const nIn = normalize(input);
  if (!nIn) return { verdict: "incorrect" };
  const candidates: { text: string; isAlt: boolean }[] = [
    { text: expected, isAlt: false },
    ...alts.map((a) => ({ text: a, isAlt: true })),
  ];
  for (const c of candidates) {
    const nEx = normalize(c.text);
    if (nIn === nEx) return { verdict: c.isAlt ? "alt" : "correct", matched: c.text };
    if (sim(nIn, nEx) >= 0.88) return { verdict: c.isAlt ? "alt" : "correct", matched: c.text };
    // token level with tolerance of 1 small typo
    const a = nIn.split(" "), b = nEx.split(" ");
    if (a.length === b.length) {
      const bad = a.filter((w, i) => sim(w, b[i]) < 0.8).length;
      if (bad <= 1) return { verdict: c.isAlt ? "alt" : "correct", matched: c.text };
    }
  }
  // meaning-based for Spanish answers
  const nExp = normalize(expected);
  if (sim(nIn, nExp) >= 0.6 && nIn.split(" ").length >= 2) return { verdict: "alt", matched: expected };
  const a = nIn.split(" "), b = nExp.split(" ");
  const diff = b.find((w, i) => a[i] === undefined || sim(a[i], w) < 0.7);
  return { verdict: "incorrect", diffWord: diff };
}

export function evaluateFree(input: string, concepts: string[][]): { tier: 0 | 1 | 2 | 3; hit: number; total: number } {
  const n = normalize(input);
  if (!n) return { tier: 0, hit: 0, total: concepts.length };
  let hit = 0;
  for (const g of concepts) if (g.some((opt) => n.includes(normalize(opt)))) hit++;
  const ratio = concepts.length ? hit / concepts.length : 0;
  const words = n.split(" ").length;
  let tier: 0 | 1 | 2 | 3 = 0;
  if (ratio >= 1 && words >= 3) tier = 3;
  else if (ratio >= 0.75) tier = 2;
  else if (ratio >= 0.4) tier = 1;
  return { tier, hit, total: concepts.length };
}

/* ---------------- Exercise construction helpers ---------------- */

export function blankTarget(phrase: Phrase): { prompt: string; answer: string } {
  const words = phrase.en.replace(/[.,!?]/g, (m) => ` ${m}`).split(" ").filter(Boolean);
  const candidates = words.filter((w) => /^[a-zA-Z']{3,}$/.test(w.replace(/'/g, "")));
  const target = candidates.sort((a, b) => b.length - a.length)[0] ?? words[0];
  const clean = target.replace(/[.,!?]$/g, "");
  const prompt = phrase.en.replace(new RegExp(`\\b${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "_____");
  return { prompt, answer: clean.toLowerCase() };
}

export function scrambleWords(phrase: Phrase, decoys: string[]): { chips: string[]; answer: string[] } {
  const words = phrase.en.replace(/[.,!?]/g, "").split(" ").filter(Boolean);
  const extras = decoys.filter((d) => !words.map((w) => w.toLowerCase()).includes(d.toLowerCase())).slice(0, phrase.difficulty >= 2 ? 2 : 1);
  const chips = [...words, ...extras].map((w, i) => ({ w, k: i })).sort(() => Math.random() - 0.5).map((x) => x.w);
  return { chips, answer: words };
}

export function pickOptions(correct: Phrase, pool: Phrase[], key: "en" | "es", n = 4): string[] {
  const others = pool.filter((p) => p.id !== correct.id && normalize(p[key]) !== normalize(correct[key]));
  const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, n - 1);
  const opts = [...shuffled.map((p) => p[key]), correct[key]].sort(() => Math.random() - 0.5);
  return opts;
}

/* ---------------- Session building ---------------- */

function exForNew(p: PhraseProgress | undefined, idx: number, settings: Settings): ExType {
  const seen = p?.timesSeen ?? 0;
  if (seen === 0) return idx % 2 === 0 ? "en_es" : "context";
  const rotate: ExType[] = ["fill", "es_en", "rebuild", "en_es"];
  return rotate[(seen + idx) % rotate.length];
}

function exForReview(p: PhraseProgress, settings: Settings): ExType {
  const last = p.lastExType;
  const prod: ExType[] = settings.speakingEnabled
    ? ["es_en", "dictation", "speaking", "context_gen", "fill", "rebuild", "en_es", "meaning", "context"]
    : ["es_en", "dictation", "context_gen", "fill", "rebuild", "en_es", "meaning", "context"];
  const rec: ExType[] = ["meaning", "context", "en_es", "fill", "rebuild"];
  let list: ExType[];
  if (p.mastery < 30) list = rec.concat(prod.filter((x) => x !== "context_gen" && x !== "speaking"));
  else if (p.mastery < 60) list = prod;
  else list = settings.speakingEnabled
    ? ["dictation", "speaking", "context_gen", "es_en", "rebuild"]
    : ["dictation", "context_gen", "es_en", "rebuild"];
  const rotated = list.filter((x) => x !== last);
  return rotated[Math.floor(Math.random() * rotated.length)] ?? list[0];
}

export interface SessionBuckets {
  overdue: Phrase[];
  weak: Phrase[];
  fresh: Phrase[];
  freshCount: number;
  newPhrases: Phrase[];
  spot: Phrase[];
}

export function computeBuckets(
  phrases: Phrase[],
  progress: Record<string, PhraseProgress>,
  settings: Settings,
  paused: string[],
  now = Date.now(),
): SessionBuckets {
  const ok = (p: Phrase) => !paused.includes(p.id);
  const overdue = phrases.filter((p) => {
    const pr = progress[p.id];
    return ok(p) && pr && pr.nextReview !== undefined && pr.nextReview <= now;
  }).sort((a, b) => (progress[a.id].nextReview ?? 0) - (progress[b.id].nextReview ?? 0));

  const weak = phrases.filter((p) => {
    const pr = progress[p.id];
    return ok(p) && pr && pr.timesSeen > 0 && pr.mastery < 40;
  }).sort((a, b) => (progress[b.id]?.incorrect ?? 0) - (progress[a.id]?.incorrect ?? 0) || (progress[a.id]?.mastery ?? 0) - (progress[b.id]?.mastery ?? 0));

  const fresh = phrases.filter((p) => {
    const pr = progress[p.id];
    return ok(p) && pr && pr.firstLearned && now - pr.firstLearned < 3 * DAY_MS && pr.mastery < 70 && pr.mastery >= 40;
  });

  const newAll = phrases.filter((p) => ok(p) && !(progress[p.id]?.timesSeen > 0));
  const levelCap = settings.level === "beginner" ? 1 : settings.level === "intermediate" ? 2 : 3;
  const wanted =
    settings.focus === "balanced" ? newAll
      : newAll.filter((p) => p.domain === settings.focus);
  const fallback = wanted.length ? wanted : newAll;
  const newPhrases = fallback
    .filter((p) => p.difficulty <= levelCap || settings.level === "advanced")
    .sort((a, b) => a.module - b.module || a.difficulty - b.difficulty)
    .slice(0, Math.max(settings.newPerDay, 4));

  const spot = phrases.filter((p) => {
    const pr = progress[p.id];
    return ok(p) && pr && pr.mastery >= 75;
  });

  return { overdue, weak, fresh, freshCount: fresh.length, newPhrases, spot };
}

export function buildDailyPlan(
  phrases: Phrase[],
  progress: Record<string, PhraseProgress>,
  settings: Settings,
  paused: string[],
  minutes: number,
  newLearnedToday: number,
  now = Date.now(),
): PlannedItem[] {
  const b = computeBuckets(phrases, progress, settings, paused, now);
  const total = Math.min(30, Math.max(6, Math.round(minutes * 1.35)));
  const items: PlannedItem[] = [];
  const used = new Set<string>();

  const newCap = Math.max(0, settings.newPerDay - newLearnedToday);
  const queues: { bucket: PlannedItem["bucket"]; list: Phrase[]; weight: number }[] = [
    { bucket: "overdue", list: b.overdue, weight: 5 },
    { bucket: "weak", list: b.weak, weight: 3 },
    { bucket: "fresh", list: b.fresh, weight: 2 },
    { bucket: "new", list: b.newPhrases.slice(0, newCap), weight: 3 },
    { bucket: "check", list: [...b.spot].sort(() => Math.random() - 0.5), weight: 1 },
  ];

  let guard = 0;
  while (items.length < total && guard++ < 500) {
    const active = queues.filter((q) => q.list.length > 0);
    if (!active.length) break;
    const sum = active.reduce((s, q) => s + q.weight, 0);
    let r = Math.random() * sum;
    let q = active[0];
    for (const a of active) { r -= a.weight; if (r <= 0) { q = a; break; } }
    const ph = q.list.shift()!;
    if (used.has(ph.id)) continue;
    used.add(ph.id);
    const pr = progress[ph.id];
    const ex = q.bucket === "new"
      ? exForNew(pr, items.length, settings)
      : q.bucket === "check"
        ? (settings.speakingEnabled ? (["dictation", "speaking", "context_gen"] as ExType[])[items.length % 3] : (["dictation", "context_gen", "es_en"] as ExType[])[items.length % 3])
        : exForReview(pr!, settings);
    items.push({ phraseId: ph.id, ex, bucket: q.bucket });
  }
  return items;
}

export function buildLessonPlan(modulePhrases: Phrase[], progress: Record<string, PhraseProgress>): PlannedItem[] {
  const items: PlannedItem[] = [];
  for (const ph of modulePhrases) {
    const pr = progress[ph.id];
    if (!pr || pr.timesSeen === 0) {
      items.push({ phraseId: ph.id, ex: "en_es", bucket: "scope" });
      items.push({ phraseId: ph.id, ex: ph.difficulty >= 2 ? "fill" : "es_en", bucket: "scope" });
    } else {
      items.push({ phraseId: ph.id, ex: exForReview(pr, { speakingEnabled: true } as Settings), bucket: "scope" });
    }
  }
  return items.sort(() => Math.random() - 0.5);
}

export function buildTestPlan(modulePhrases: Phrase[], progress: Record<string, PhraseProgress>, speakingEnabled: boolean): PlannedItem[] {
  const sorted = [...modulePhrases].sort((a, b) => (progress[a.id]?.mastery ?? 0) - (progress[b.id]?.mastery ?? 0));
  const cycle: ExType[] = speakingEnabled
    ? ["es_en", "meaning", "context", "dictation", "fill", "speaking", "rebuild", "es_en", "context_gen", "listen"]
    : ["es_en", "meaning", "context", "dictation", "fill", "rebuild", "es_en", "context_gen", "listen", "fill"];
  return sorted.slice(0, 10).map((ph, i) => {
    let ex = cycle[i % cycle.length];
    if (ex === "context_gen" && (progress[ph.id]?.mastery ?? 0) < 30) ex = "en_es";
    return { phraseId: ph.id, ex, bucket: "scope" as const };
  });
}

export function buildReviewPlan(ids: string[], phrases: Phrase[], progress: Record<string, PhraseProgress>, settings: Settings): PlannedItem[] {
  const list = phrases.filter((p) => ids.includes(p.id));
  return list.map((ph) => {
    const pr = progress[ph.id];
    return {
      phraseId: ph.id,
      ex: pr && pr.timesSeen > 0 ? exForReview(pr, settings) : ("en_es" as ExType),
      bucket: "scope" as const,
    };
  });
}

export function sessionConfig(title: string, mode: SessionConfig["mode"], items: PlannedItem[], subtitle?: string, metaId?: string): SessionConfig {
  return { title, subtitle, mode, items, metaId };
}

/* ---------------- Feedback / tutor ---------------- */

export interface Feedback {
  verdict: Verdict;
  headline: string;
  lines: string[];
  corrected?: string;
  tip?: string;
}

export function buildFeedback(
  verdict: Verdict,
  phrase: Phrase,
  userInput: string,
  ex: ExType,
  matched?: string,
  tier?: number,
): Feedback {
  if (verdict === "correct") {
    return {
      verdict,
      headline: ["Correct.", "Exactly.", "Nailed it.", "That's right."][Math.floor(Math.random() * 4)],
      lines: [],
      tip: Math.random() < 0.4 ? phrase.grammar : undefined,
    };
  }
  if (verdict === "alt") {
    return {
      verdict,
      headline: "Correct — good alternative.",
      lines: [
        `Your answer works: "${userInput.trim()}"`,
        `The phrase we're training is: "${matched ?? phrase.en}"`,
      ],
      tip: phrase.grammar,
    };
  }
  // incorrect — tutor-style repair
  const lines: string[] = [];
  const cleaned = userInput.trim();
  if (cleaned) lines.push(`You wrote: "${cleaned}"`);
  if (ex === "es_en" || ex === "dictation" || ex === "fill" || ex === "speaking") {
    lines.push(`Target: "${phrase.en}"`);
  } else {
    lines.push(`Meaning: "${phrase.es}" · also "${phrase.alt}"`);
  }
  if (phrase.mistakes && (ex === "es_en" || ex === "speaking" || ex === "context_gen")) {
    lines.push(phrase.mistakes);
  }
  let tip = phrase.grammar;
  if (tier !== undefined && tier <= 1) {
    tip = ex === "context_gen" || ex === "conversation"
      ? "A native speaker would include the key idea more directly — compare with the model answer."
      : phrase.grammar;
  }
  return { verdict, headline: "Almost — let's fix it.", lines, corrected: phrase.en, tip };
}

export function tutorReview(input: string, phrase: Phrase, tier: number): { label: string; body: string } {
  const labels = ["Incorrect", "Understandable, but unnatural", "Natural", "Very natural"];
  const bodies = [
    `That doesn't quite work here. The natural reply is: "${phrase.en}" — pattern: ${phrase.grammar}`,
    `A native speaker would understand you, but would more commonly say: "${phrase.en}"`,
    `Nice. A native speaker would commonly say: "${phrase.en}"`,
    `Excellent — that sounds exactly like a native speaker.`,
  ];
  return { label: labels[tier] ?? labels[0], body: bodies[tier] ?? bodies[0] };
}

/* ---------------- XP ---------------- */

export function xpFor(ex: ExType, verdict: Verdict): number {
  const base = { correct: 8, alt: 5, incorrect: 2 }[verdict];
  const bonus = ["es_en", "dictation", "speaking", "context_gen", "conversation"].includes(ex) ? 3 : 0;
  return base + (verdict !== "incorrect" ? bonus : 0);
}

/* ---------------- Stats ---------------- */

export interface Stats {
  total: number;
  byState: Record<string, number>;
  overallMastery: number;
  accuracy: number;
  productionAccuracy: number;
  listeningAccuracy: number;
  speakingAccuracy: number;
  everydayAccuracy: number;
  medicalAccuracy: number;
  delayedAccuracy: number;
  dueToday: number;
  weakCount: number;
  masteredCount: number;
  strongCount: number;
  everydayPct: number;
  medicalPct: number;
  weekMinutes: number[];
  weekXp: number[];
  weekLabels: string[];
  masteredPerWeek: number[];
  accuracyTrend: number[];
  weakest: { name: string; acc: number; n: number }[];
  strongest: { name: string; acc: number; n: number }[];
}

const PROD: ExType[] = ["es_en", "dictation", "context_gen", "fill", "rebuild", "conversation"];
const LISTEN: ExType[] = ["meaning", "listen", "dictation"];

export function computeStats(data: UserData, phrases: Phrase[], now = Date.now()): Stats {
  const byState: Record<string, number> = {};
  for (const s of STATE_ORDER) byState[s] = 0;
  let sumM = 0, counted = 0;
  for (const ph of phrases) {
    const st = getState(data.progress[ph.id], now);
    byState[st] += 1;
    const m = data.progress[ph.id]?.mastery ?? 0;
    sumM += m; counted++;
  }
  const acc = (pred: (a: Attempt) => boolean) => {
    const sel = data.attempts.filter(pred);
    if (!sel.length) return 0;
    return Math.round((sel.filter((a) => a.result !== "incorrect").length / sel.length) * 100);
  };
  const isOk = (a: Attempt) => a.result !== "incorrect";

  const weekLabels: string[] = [];
  const weekMinutes: number[] = [];
  const weekXp: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const k = dateKeyOffset(i);
    weekLabels.push(new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }));
    weekMinutes.push(Math.round(data.dailyLog[k]?.minutes ?? 0));
    weekXp.push(data.dailyLog[k]?.xp ?? 0);
  }

  // mastered per week (last 8 weeks), from masteredAt timestamps
  const masteredPerWeek: number[] = Array(8).fill(0);
  const weekStart = now - 7 * 7 * DAY_MS;
  for (const p of Object.values(data.progress)) {
    if (p.masteredAt && p.masteredAt >= weekStart) {
      const idx = 7 - Math.floor((now - p.masteredAt) / (7 * DAY_MS));
      if (idx >= 0 && idx < 8) masteredPerWeek[idx]++;
    }
  }

  const accuracyTrend = data.history.slice(-12).map((s) =>
    s.exercises ? Math.round(((s.correct + s.alt) / s.exercises) * 100) : 0,
  );

  // category accuracy from attempts joined with phrases
  const byCat: Record<string, { ok: number; n: number }> = {};
  const pmap = new Map(phrases.map((p) => [p.id, p]));
  for (const a of data.attempts) {
    const ph = pmap.get(a.phraseId);
    if (!ph) continue;
    const k = ph.subcategory;
    byCat[k] = byCat[k] ?? { ok: 0, n: 0 };
    byCat[k].n++;
    if (isOk(a)) byCat[k].ok++;
  }
  const cats = Object.entries(byCat)
    .filter(([, v]) => v.n >= 3)
    .map(([name, v]) => ({ name, acc: Math.round((v.ok / v.n) * 100), n: v.n }))
    .sort((a, b) => a.acc - b.acc);

  const everyday = phrases.filter((p) => p.domain === "everyday");
  const medical = phrases.filter((p) => p.domain === "medical");
  const pctMastered = (list: Phrase[]) => {
    const m = list.filter((p) => (data.progress[p.id]?.mastery ?? 0) >= 75).length;
    return list.length ? Math.round((m / list.length) * 100) : 0;
  };

  return {
    total: phrases.length,
    byState,
    overallMastery: counted ? Math.round(sumM / counted) : 0,
    accuracy: acc(() => true),
    productionAccuracy: acc((a) => PROD.includes(a.ex)),
    listeningAccuracy: acc((a) => LISTEN.includes(a.ex)),
    speakingAccuracy: acc((a) => a.ex === "speaking" || a.ex === "conversation"),
    everydayAccuracy: acc((a) => a.domain === "everyday"),
    medicalAccuracy: acc((a) => a.domain === "medical"),
    delayedAccuracy: acc((a) => {
      const p = data.progress[a.phraseId];
      return !!p && (p.interval ?? 0) >= 1;
    }),
    dueToday: dueCount(data.progress, now),
    weakCount: Object.values(data.progress).filter((p) => p.timesSeen > 0 && p.mastery < 40).length,
    masteredCount: phrases.filter((p) => (data.progress[p.id]?.mastery ?? 0) >= 75).length,
    strongCount: phrases.filter((p) => { const m = data.progress[p.id]?.mastery ?? 0; return m >= 60 && m < 75; }).length,
    everydayPct: pctMastered(everyday),
    medicalPct: pctMastered(medical),
    weekMinutes, weekXp, weekLabels, masteredPerWeek, accuracyTrend,
    weakest: cats.slice(0, 3),
    strongest: cats.slice(-3).reverse(),
  };
}

/* ---------------- Recommendations ---------------- */

export function recommendations(data: UserData, phrases: Phrase[], now = Date.now()): string[] {
  const recs: string[] = [];
  const due = dueCount(data.progress, now);
  if (due > 0) recs.push(`You have ${due} phrase${due === 1 ? "" : "s"} due for review today.`);
  const weakening = Object.entries(data.progress).filter(([, p]) => p.mastery >= 40 && p.mastery < 55 && p.lapses > 0).length;
  if (weakening > 0) recs.push(`${weakening} phrase${weakening === 1 ? " is" : "s are"} becoming weak — a quick review will lock them in.`);
  const repeatMiss = phrases.filter((p) => { const pr = data.progress[p.id]; return pr && pr.incorrect >= 3 && pr.mastery < 50; });
  if (repeatMiss.length) recs.push(`"${repeatMiss[0].en}" has been missed ${repeatMiss[0] ? data.progress[repeatMiss[0].id]?.incorrect : 0} times — expect it in today's session.`);
  // stale module
  const staleModule = MODULES.map((m) => {
    const ids = phrases.filter((p) => p.module === m.id).map((p) => p.id);
    const seen = ids.map((id) => data.progress[id]?.lastReviewed ?? 0).filter(Boolean);
    const latest = seen.length ? Math.max(...seen) : 0;
    return { m, days: latest ? Math.floor((now - latest) / DAY_MS) : -1 };
  }).filter((x) => x.days >= 7).sort((a, b) => b.days - a.days)[0];
  if (staleModule) recs.push(`You haven't reviewed Module ${staleModule.m.id} (${staleModule.m.title}) in ${staleModule.days} days.`);
  const today = data.dailyLog[todayKey(now)];
  if (!today?.exercises) recs.push("You haven't practiced yet today — a short session keeps your streak alive.");
  if (!recs.length) recs.push("Everything is on schedule. A 5-minute review keeps long-term memory sharp.");
  return recs.slice(0, 4);
}

/* ---------------- Achievements ---------------- */

export function checkAchievements(data: UserData, phrases: Phrase[]): string[] {
  const unlocked: string[] = [];
  const has = (id: string) => data.achievements[id];
  const mastered = phrases.filter((p) => (data.progress[p.id]?.mastery ?? 0) >= 75).length;
  const longTerm = Object.values(data.progress).filter((p) => p.longTermAt).length;
  const doneConvos = Object.keys(data.conversationBest).length;
  const medTestPassed = Object.entries(data.moduleTests).some(([id, t]) => t.passed && Number(id) >= 6);
  const rules: Record<string, boolean> = {
    "first-session": data.history.length > 0,
    "mastered-10": mastered >= 10,
    "mastered-50": mastered >= 50,
    "mastered-100": mastered >= 100,
    "streak-3": data.streak.current >= 3,
    "streak-7": data.streak.current >= 7,
    "streak-30": data.streak.current >= 30,
    "medical-m1": medTestPassed,
    "accuracy-90": data.history.some((s) => s.exercises >= 10 && (s.correct + s.alt) / s.exercises >= 0.9),
    "xp-1000": data.totalXp >= 1000,
    "longterm-1": longTerm >= 1,
    "convo-3": doneConvos >= 3,
  };
  for (const [id, ok] of Object.entries(rules)) if (ok && !has(id)) unlocked.push(id);
  return unlocked;
}

/* ---------------- Misc shared ---------------- */

export function allPhrases(custom: Phrase[]): Phrase[] {
  return [...PHRASES, ...custom];
}

export function phrasesOfModule(moduleId: number, custom: Phrase[]): Phrase[] {
  return allPhrases(custom).filter((p) => p.module === moduleId);
}

export function moduleUnlocked(moduleId: number, data: UserData, phrases: Phrase[]): boolean {
  if (moduleId === 1) return true;
  const prev = data.moduleTests[moduleId - 1];
  if (prev?.passed) return true;
  const prevPhrases = phrases.filter((p) => p.module === moduleId - 1);
  if (!prevPhrases.length) return true;
  const avg = prevPhrases.reduce((s, p) => s + (data.progress[p.id]?.mastery ?? 0), 0) / prevPhrases.length;
  const allSeen = prevPhrases.every((p) => (data.progress[p.id]?.timesSeen ?? 0) > 0);
  return allSeen && avg >= 60;
}

export function fmtInterval(days: number): string {
  if (days < 1) return `${Math.round(days * 24 * 60)} min`;
  if (days < 30) return `${Math.round(days)}d`;
  return `${Math.round(days / 30)}mo`;
}

export function timeAgo(t: number, now = Date.now()): string {
  const d = now - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < DAY_MS) return `${Math.floor(d / 3_600_000)}h ago`;
  const days = Math.floor(d / DAY_MS);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function nextReviewLabel(p: PhraseProgress | undefined, now = Date.now()): string {
  if (!p || p.nextReview === undefined) return "Not scheduled";
  const diff = p.nextReview - now;
  if (diff <= 0) return "Due now";
  if (diff < DAY_MS) return `in ${Math.max(1, Math.round(diff / 3_600_000))}h`;
  return `in ${Math.ceil(diff / DAY_MS)}d`;
}
