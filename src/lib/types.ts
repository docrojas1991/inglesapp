/* ============================================================
   SCHEMA — mirrors the Postgres models a hosted deployment
   would use (users, phrases, user_phrase_progress,
   review_history, exercise_attempts, study_sessions,
   achievements, user_settings, conversation_sessions).
   ============================================================ */

export type Domain = "everyday" | "medical" | "street";
export type PhraseState =
  | "NEW" | "LEARNING" | "REVIEWING" | "STRUGGLING"
  | "NEEDS_REVIEW" | "STRONG" | "MASTERED" | "LONG_TERM_MASTERED";

export type ExType =
  | "en_es" | "meaning" | "context" | "fill" | "rebuild" | "listen"
  | "dictation" | "es_en" | "speaking" | "context_gen" | "conversation";

export interface ModuleInfo {
  id: number;
  title: string;
  domain: Domain;
  blurb: string;
}

export interface Phrase {
  id: string;
  module: number;
  domain: Domain;
  category: string;
  subcategory: string;
  difficulty: 1 | 2 | 3;
  en: string;
  es: string;
  alt: string;
  explain: string;
  grammar: string;
  scenario: string;
  example: string;
  concepts: string[][];
  tags: string[];
  pron?: string;
  mistakes?: string;
  exampleEs?: string;
  custom?: boolean;
}

export interface PhraseProgress {
  mastery: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  consec: number;
  timesSeen: number;
  correct: number;
  incorrect: number;
  firstLearned?: number;
  lastReviewed?: number;
  nextReview?: number;
  masteredAt?: number;
  longTermAt?: number;
  lastExType?: ExType;
  lastResult?: Verdict;
  /** interval (days) of the last cleared review — retention proof */
  lastIntervalDays?: number;
  exTypes: Partial<Record<ExType, number>>;
}

export type Verdict = "correct" | "alt" | "incorrect";

export interface StudySession {
  id: string;
  date: number;
  dateKey: string;
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
  mode: "daily" | "review" | "test" | "conversation" | "lesson" | "single";
}

export interface Attempt {
  t: number;
  phraseId: string;
  ex: ExType;
  result: Verdict;
  domain: Domain;
}

export type AiProvider = "local" | "custom";

export interface AiSettings {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiMsg {
  role: "user" | "assistant";
  content: string;
  t: number;
}

export interface Settings {
  dailyGoalMinutes: number;
  newPerDay: number;
  focus: "everyday" | "medical" | "balanced";
  level: "beginner" | "intermediate" | "advanced";
  audioAutoplay: boolean;
  audioRate: "normal" | "slow";
  speakingEnabled: boolean;
  darkMode: boolean;
  ai: AiSettings;
}

export interface DailyLog {
  xp: number;
  minutes: number;
  exercises: number;
  correct: number;
  incorrect: number;
  newLearned: number;
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

export interface PlannedItem {
  phraseId: string;
  ex: ExType;
  bucket: "overdue" | "weak" | "fresh" | "new" | "check" | "scope";
  requeues?: number;
}

export interface SessionConfig {
  title: string;
  subtitle?: string;
  mode: "daily" | "review" | "test" | "conversation" | "lesson" | "single";
  items: PlannedItem[];
  metaId?: string;
}

export interface ConvTurn {
  speaker: "partner" | "user";
  text?: string;
  context?: string;
  model: string;
  concepts: string[][];
  tip?: string;
}

export interface ConversationScenario {
  id: string;
  title: string;
  domain: Domain;
  difficulty: 1 | 2 | 3;
  role: string;
  partner: string;
  setting: string;
  turns: ConvTurn[];
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
}

export interface UserData {
  version: number;
  onboarded: boolean;
  settings: Settings;
  progress: Record<string, PhraseProgress>;
  history: StudySession[];
  attempts: Attempt[];
  achievements: Record<string, string>;
  favorites: string[];
  notes: Record<string, string>;
  reported: string[];
  paused: string[];
  lessonsDone: string[];
  moduleTests: Record<number, { score: number; passed: boolean; date: number }>;
  customPhrases: Phrase[];
  conversationBest: Record<string, number>;
  dailyLog: Record<string, DailyLog>;
  aiChat: AiMsg[];
  pronCount: number;
  streak: { current: number; best: number; last: string };
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

export type RouteId =
  | "dashboard" | "modules" | "street" | "review" | "library"
  | "conversations" | "history" | "settings";
