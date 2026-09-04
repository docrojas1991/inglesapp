/* ============================================================
   Fluencia — domain types (schema-shaped for a future SQL DB:
   users / phrases / user_phrase_progress / review_history /
   exercise_attempts / study_sessions / achievements / settings)
   ============================================================ */

export type Domain = "everyday" | "medical";

export type ExType =
  | "en_es" // English -> Spanish meaning (recognition)
  | "meaning" // audio -> Spanish meaning (listening recognition)
  | "context" // scenario -> pick natural phrase (recognition)
  | "fill" // fill in the blank (moderate production)
  | "rebuild" // reorder scrambled words
  | "listen" // audio -> type Spanish meaning (listening)
  | "dictation" // audio -> type English exactly
  | "es_en" // Spanish -> English typing (active production)
  | "speaking" // speak the English phrase
  | "context_gen" // scenario -> produce a natural response
  | "conversation"; // simulated dialogue turn

export type Verdict = "correct" | "alt" | "incorrect";

export type PhraseState =
  | "NEW"
  | "LEARNING"
  | "REVIEWING"
  | "STRUGGLING"
  | "NEEDS_REVIEW"
  | "STRONG"
  | "MASTERED"
  | "LONG_TERM_MASTERED";

export interface Phrase {
  id: string;
  module: number;
  category: string;
  subcategory: string;
  domain: Domain;
  en: string;
  es: string;
  alt: string; // natural alternative translation
  explain: string; // short explanation
  grammar: string; // structure note
  pron?: string; // pronunciation guidance
  difficulty: 1 | 2 | 3;
  tags: string[];
  example: string;
  exampleEs?: string;
  scenario: string; // contextual situation for context exercises
  concepts: string[][]; // synonym groups used for semantic evaluation
  mistakes?: string; // common user mistake
  custom?: boolean;
}

export interface ModuleInfo {
  id: number;
  title: string;
  domain: Domain;
  blurb: string;
}

export interface PhraseProgress {
  mastery: number; // 0-100
  interval: number; // days (fractions for intra-day steps)
  ease: number; // SM-2 style ease factor
  reps: number;
  lapses: number;
  consec: number; // consecutive correct
  timesSeen: number;
  correct: number;
  incorrect: number;
  lastReviewed?: number;
  nextReview?: number;
  firstLearned?: number;
  masteredAt?: number;
  longTermAt?: number;
  lastExType?: ExType;
  lastResult?: Verdict;
  lastIntervalDays?: number; // interval cleared at last successful review
  exTypes: Partial<Record<ExType, number>>; // correct counts per exercise type
}

export interface Settings {
  dailyGoalMinutes: 5 | 10 | 15 | 20;
  newPerDay: number;
  focus: "everyday" | "medical" | "balanced";
  level: "beginner" | "intermediate" | "advanced";
  audioAutoplay: boolean;
  audioRate: "normal" | "slow";
  speakingEnabled: boolean;
  darkMode: boolean;
}

export interface Attempt {
  t: number;
  phraseId: string;
  ex: ExType;
  result: Verdict;
  domain: Domain;
}

export interface StudySession {
  id: string;
  date: number; // epoch ms
  dateKey: string; // local YYYY-MM-DD
  minutes: number;
  exercises: number;
  correct: number;
  incorrect: number;
  alt: number;
  xp: number;
  newLearned: string[];
  strengthened: string[];
  mastered: string[];
  weakened: string[];
  mode: "daily" | "review" | "lesson" | "test" | "conversation" | "single";
}

export interface PlannedItem {
  phraseId: string;
  ex: ExType;
  bucket: "overdue" | "weak" | "fresh" | "new" | "check" | "scope";
}

export interface SessionConfig {
  title: string;
  subtitle?: string;
  mode: StudySession["mode"];
  items: PlannedItem[];
  metaId?: string; // e.g. "m3-l1" lesson id or module test id
}

export interface SessionSummary {
  exercises: number;
  correct: number;
  incorrect: number;
  alt: number;
  accuracy: number;
  xp: number;
  seconds: number;
  newLearned: string[];
  strengthened: string[];
  mastered: string[];
  weakened: string[];
  weakIds: string[];
}

export interface DailyLog {
  xp: number;
  minutes: number;
  exercises: number;
  correct: number;
  incorrect: number;
  newLearned: number;
}

export interface UserData {
  version: number;
  onboarded: boolean;
  settings: Settings;
  progress: Record<string, PhraseProgress>;
  history: StudySession[];
  attempts: Attempt[]; // rolling window (last 600)
  achievements: Record<string, string>; // achievementId -> ISO date
  favorites: string[];
  notes: Record<string, string>;
  reported: string[];
  paused: string[];
  lessonsDone: string[]; // "m1-l1"
  moduleTests: Record<number, { score: number; passed: boolean; date: number }>;
  customPhrases: Phrase[];
  conversationBest: Record<string, number>; // scenarioId -> best % score
  dailyLog: Record<string, DailyLog>;
  streak: { current: number; best: number; last: string }; // last = dateKey
  totalXp: number;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passHash: string;
  createdAt: number;
  demo?: boolean;
}

export interface ConvTurn {
  speaker: "partner" | "user";
  text?: string; // partner line
  context?: string; // instruction shown for a user turn
  model: string; // model answer for user turns
  concepts: string[][]; // required concept groups (synonyms) for user turns
  tip?: string;
}

export interface ConversationScenario {
  id: string;
  title: string;
  domain: Domain;
  difficulty: 1 | 2 | 3;
  role: string; // who the user plays
  partner: string; // who the partner is
  setting: string;
  turns: ConvTurn[];
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string; // lucide icon name
}

export type RouteId =
  | "dashboard"
  | "modules"
  | "review"
  | "library"
  | "conversations"
  | "history"
  | "settings";
