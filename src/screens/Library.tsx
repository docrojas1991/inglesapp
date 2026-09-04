import { useMemo, useState } from "react";
import type { Phrase, PhraseState } from "../lib/types";
import { useApp } from "../store";
import {
  buildReviewPlan, fmtInterval, getState, nextReviewLabel, normalize, timeAgo, STATE_ORDER,
} from "../lib/engine";
import { MODULES, EX_LABELS } from "../lib/data";
import { speak, createRecognizer, sttAvailable, stopSpeaking } from "../lib/audio";
import { Button, Card, Chip, ProgressBar, StateChip, cx } from "../ui";
import {
  BookOpen, Flag, Heart, Mic, Pause, Play, RotateCcw, Search, Sparkles, Star, Stethoscope, Volume2, X,
} from "lucide-react";

function AudioChip({ text, slow }: { text: string; slow?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); speak(text, { rate: slow ? 0.62 : 0.95 }); }}
      className="btn-press focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pine-50 text-pine-700 hover:bg-pine-100 dark:bg-pine-900/50 dark:text-pine-300 dark:hover:bg-pine-900"
      aria-label={slow ? "Play slowly" : "Play audio"}
      title={slow ? "Slow" : "Play"}
    >
      {slow ? <Pause size={13} /> : <Volume2 size={14} />}
    </button>
  );
}

function ShadowBox({ phrase }: { phrase: Phrase }) {
  const [stage, setStage] = useState<"idle" | "playing" | "recording" | "done">("idle");
  const [transcript, setTranscript] = useState("");
  const supported = sttAvailable();
  const run = () => {
    setStage("playing");
    setTranscript("");
    speak(phrase.en, {
      rate: 0.9,
      onend: () => {
        if (!supported) { setStage("done"); return; }
        setStage("recording");
        const rec = createRecognizer({
          onResult: (t, fin) => { setTranscript(t); if (fin) setStage("done"); },
          onEnd: () => setStage("done"),
          onError: () => setStage("done"),
        });
        rec.start();
      },
    });
  };
  const score = useMemo(() => {
    if (!transcript) return null;
    const a = normalize(transcript).split(" ");
    const b = normalize(phrase.en).split(" ");
    let hit = 0;
    for (const w of a) if (b.some((x) => Math.abs(x.length - w.length) < 3 && (x === w || x.includes(w) || w.includes(x)))) hit++;
    return Math.round((hit / Math.max(1, b.length)) * 100);
  }, [transcript, phrase]);
  return (
    <div className="rounded-xl border border-dashed border-pine-300 bg-pine-50/60 p-4 dark:border-pine-800 dark:bg-pine-900/30">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pine-700 dark:text-pine-300">
        <Sparkles size={13} /> Shadowing mode
      </p>
      <p className="mt-1 text-xs text-mute dark:text-faint">Listen → pause → repeat out loud. {supported ? "We'll transcribe you." : "Mic transcription isn't available in this browser — repeat and self-check."}</p>
      <div className="mt-3 flex items-center gap-2">
        {stage === "idle" && <Button size="sm" onClick={run}><Play size={13} /> Play &amp; record</Button>}
        {stage === "playing" && <Chip tone="pine"><Volume2 size={11} /> playing…</Chip>}
        {stage === "recording" && <Chip tone="clay"><Mic size={11} /> listening…</Chip>}
        {stage === "done" && (
          <>
            <Button size="sm" variant="outline" onClick={run}><RotateCcw size={13} /> Again</Button>
            {transcript && <Chip tone={score !== null && score >= 70 ? "pine" : "gold"}>match ≈ {score}%</Chip>}
          </>
        )}
      </div>
      {transcript && <p className="mt-2 text-sm">“{transcript}”</p>}
    </div>
  );
}

function PhraseDetail({ phrase, onClose }: { phrase: Phrase; onClose: () => void }) {
  const { data, toggleFavorite, setNote, resetPhrase, togglePause, reportPhrase, startPractice, toast } = useApp();
  const pr = data.progress[phrase.id];
  const state = getState(pr);
  const [note, setNoteLocal] = useState(data.notes[phrase.id] ?? "");
  const fav = data.favorites.includes(phrase.id);
  const paused = data.paused.includes(phrase.id);
  const reported = data.reported.includes(phrase.id);
  const mod = MODULES.find((m) => m.id === phrase.module);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-[2px] dark:bg-black/50" onClick={onClose}>
      <div
        className="anim-slide h-full w-full max-w-lg overflow-y-auto border-l border-line bg-panel p-6 shadow-pop dark:border-nline dark:bg-carbon"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StateChip state={state} />
            <Chip tone={phrase.domain === "medical" ? "med" : "pine"}>{phrase.domain}</Chip>
            <Chip>Module {phrase.module}</Chip>
          </div>
          <button onClick={onClose} className="btn-press focus-ring rounded-lg p-1.5 text-mute hover:bg-paper dark:hover:bg-carbon2" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight">“{phrase.en}”</h2>
        <p className="mt-1 text-lg text-mute dark:text-faint" dir="auto">{phrase.es} <span className="text-sm">· also: {phrase.alt}</span></p>
        {phrase.pron && <p className="mt-1 font-mono text-xs text-faint">/{phrase.pron}/</p>}

        <div className="mt-4 flex items-center gap-2">
          <AudioChip text={phrase.en} />
          <AudioChip text={phrase.en} slow />
          <Button size="sm" variant="outline" onClick={() => { onClose(); startPractice({ title: "Phrase drill", mode: "single", items: [{ phraseId: phrase.id, ex: pr && pr.mastery >= 40 ? "es_en" : "en_es", bucket: "scope" }] }); }}>
            Practice this phrase
          </Button>
          <button
            onClick={() => { toggleFavorite(phrase.id); toast(fav ? "Removed from favorites" : "Added to favorites", "gold"); }}
            className={cx("btn-press focus-ring ml-auto rounded-lg p-2", fav ? "bg-gold-100 text-gold-500 dark:bg-gold-400/15" : "text-faint hover:text-gold-500")}
            aria-label="Favorite"
          >
            <Star size={18} fill={fav ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-faint">How it's used</p>
            <p className="mt-1.5 text-sm leading-relaxed">{phrase.explain}</p>
            <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm italic dark:bg-night">“{phrase.example}”</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-faint">Pattern</p>
            <p className="mt-1.5 text-sm font-medium text-pine-800 dark:text-pine-200">{phrase.grammar}</p>
            {phrase.mistakes && <p className="mt-2 text-sm text-clay-600 dark:text-clay-400">Watch out · {phrase.mistakes}</p>}
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-faint">Scenario</p>
            <p className="mt-1.5 text-sm">{phrase.scenario}</p>
          </Card>
          <ShadowBox phrase={phrase} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-line p-3 dark:border-nline">
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Mastery</p>
            <p className="mt-1 font-display text-xl font-extrabold">{Math.round(pr?.mastery ?? 0)}%</p>
            <ProgressBar value={pr?.mastery ?? 0} className="mt-2 h-1.5" />
          </div>
          <div className="rounded-xl border border-line p-3 dark:border-nline">
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Schedule</p>
            <p className="mt-1 text-sm font-semibold">{nextReviewLabel(pr)}</p>
            <p className="text-xs text-faint">interval {pr ? fmtInterval(pr.interval) : "—"} · {pr?.lastReviewed ? `seen ${timeAgo(pr.lastReviewed)}` : "never seen"}</p>
          </div>
          <div className="rounded-xl border border-line p-3 dark:border-nline">
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Record</p>
            <p className="mt-1 text-sm font-semibold">{pr?.correct ?? 0} correct · {pr?.incorrect ?? 0} missed</p>
            <p className="text-xs text-faint">seen {pr?.timesSeen ?? 0}×{pr?.lastExType ? ` · last: ${EX_LABELS[pr.lastExType]}` : ""}</p>
          </div>
          <div className="rounded-xl border border-line p-3 dark:border-nline">
            <p className="text-[10px] font-bold uppercase tracking-widest text-faint">Tags</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {phrase.tags.map((t) => <Chip key={t} className="!px-2 !text-[10px]">{t}</Chip>)}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-faint">Personal notes</p>
          <textarea
            value={note}
            onChange={(e) => setNoteLocal(e.target.value)}
            rows={2}
            placeholder="Memory hooks, personal examples…"
            className="focus-ring mt-2 w-full resize-none rounded-xl border-2 border-line bg-paper/60 px-3 py-2.5 text-sm focus:border-pine-500 dark:border-nline dark:bg-night/60"
          />
          <div className="mt-1 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => { setNote(phrase.id, note); toast("Note saved"); }}>Save note</Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 dark:border-nline">
          <Button size="sm" variant={paused ? "outline" : "ghost"} onClick={() => { togglePause(phrase.id); toast(paused ? "Phrase resumed" : "Phrase paused — it will stay out of daily sessions", paused ? "pine" : "gold"); }}>
            <Pause size={13} /> {paused ? "Resume phrase" : "Pause phrase"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { resetPhrase(phrase.id); toast("Progress reset for this phrase", "clay"); }}>
            <RotateCcw size={13} /> Reset progress
          </Button>
          <Button size="sm" variant="ghost" disabled={reported} onClick={() => { reportPhrase(phrase.id); toast("Thanks — content flagged for review"); }}>
            <Flag size={13} /> {reported ? "Reported" : "Report issue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Library() {
  const { phrases, data, toggleFavorite } = useApp();
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState<"all" | "everyday" | "medical">("all");
  const [mod, setMod] = useState(0);
  const [stateF, setStateF] = useState<"all" | PhraseState>("all");
  const [favOnly, setFavOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const nq = normalize(q);
    return phrases.filter((p) => {
      if (domain !== "all" && p.domain !== domain) return false;
      if (mod && p.module !== mod) return false;
      if (favOnly && !data.favorites.includes(p.id)) return false;
      if (stateF !== "all" && getState(data.progress[p.id]) !== stateF) return false;
      if (!nq) return true;
      return normalize(p.en).includes(nq) || normalize(p.es).includes(nq) || normalize(p.alt).includes(nq)
        || p.tags.some((t) => normalize(t).includes(nq)) || normalize(p.category).includes(nq) || normalize(p.subcategory).includes(nq);
    });
  }, [phrases, q, domain, mod, stateF, favOnly, data.favorites, data.progress]);

  const open = openId ? phrases.find((p) => p.id === openId) ?? null : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <div className="anim-rise">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Phrase library</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Every phrase, on demand.</h1>
        <p className="mt-1 text-sm text-mute dark:text-faint">{phrases.length} phrases · search in English or Spanish, filter by module, domain or memory state.</p>
      </div>

      <div className="anim-rise mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search “take care”, “presión”, tags…"
            className="focus-ring w-full rounded-xl border-2 border-line bg-panel py-2.5 pl-9 pr-3 text-sm focus:border-pine-500 dark:border-nline dark:bg-carbon"
          />
        </div>
        <select value={mod} onChange={(e) => setMod(Number(e.target.value))}
          className="focus-ring rounded-xl border-2 border-line bg-panel px-3 py-2.5 text-sm font-medium dark:border-nline dark:bg-carbon">
          <option value={0}>All modules</option>
          {MODULES.map((m) => <option key={m.id} value={m.id}>M{m.id} · {m.title}</option>)}
        </select>
        <select value={stateF} onChange={(e) => setStateF(e.target.value as "all" | PhraseState)}
          className="focus-ring rounded-xl border-2 border-line bg-panel px-3 py-2.5 text-sm font-medium dark:border-nline dark:bg-carbon">
          <option value="all">Any state</option>
          {STATE_ORDER.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <button onClick={() => setDomain(domain === "all" ? "everyday" : domain === "everyday" ? "medical" : "all")}
          className={cx("btn-press focus-ring flex items-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold",
            domain === "medical" ? "border-med-400 bg-med-100 text-med-600 dark:border-med-500/40 dark:bg-med-500/15 dark:text-med-400"
              : domain === "everyday" ? "border-pine-400 bg-pine-50 text-pine-700 dark:border-pine-700 dark:bg-pine-900/40 dark:text-pine-300"
                : "border-line bg-panel text-mute dark:border-nline dark:bg-carbon")}>
          {domain === "medical" ? <Stethoscope size={14} /> : <BookOpen size={14} />}
          {domain === "all" ? "Both domains" : domain}
        </button>
        <button onClick={() => setFavOnly(!favOnly)}
          className={cx("btn-press focus-ring flex items-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold",
            favOnly ? "border-gold-300 bg-gold-100 text-gold-600 dark:border-gold-400/40 dark:bg-gold-400/15 dark:text-gold-300" : "border-line bg-panel text-mute dark:border-nline dark:bg-carbon")}>
          <Star size={14} fill={favOnly ? "currentColor" : "none"} /> Favorites
        </button>
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-faint">{list.length} result{list.length === 1 ? "" : "s"}</p>
      <div className="stagger mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, 60).map((p) => {
          const pr = data.progress[p.id];
          const st = getState(pr);
          const fav = data.favorites.includes(p.id);
          return (
            <Card key={p.id} className="group p-4" onClick={() => setOpenId(p.id)}>
              <div className="flex items-start justify-between gap-2">
                <StateChip state={st} />
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                  className={cx("btn-press focus-ring rounded-md p-1", fav ? "text-gold-500" : "text-line hover:text-gold-400 dark:text-nline")}
                  aria-label="Toggle favorite"
                >
                  <Heart size={16} fill={fav ? "currentColor" : "none"} />
                </button>
              </div>
              <p className="mt-2.5 font-display text-lg font-bold leading-snug group-hover:text-pine-700 dark:group-hover:text-pine-300">{p.en}</p>
              <p className="mt-0.5 text-sm text-mute dark:text-faint" dir="auto">{p.es}</p>
              <div className="mt-3 flex items-center gap-2">
                <ProgressBar value={pr?.mastery ?? 0} className="h-1.5 flex-1" tone={p.domain === "medical" ? "med" : "pine"} />
                <span className="font-mono text-[10px] font-bold text-faint">{Math.round(pr?.mastery ?? 0)}%</span>
                <AudioChip text={p.en} />
              </div>
            </Card>
          );
        })}
      </div>
      {list.length > 60 && <p className="mt-4 text-center text-xs text-faint">Showing first 60 — refine your search to see the rest.</p>}

      {open && <PhraseDetail phrase={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ---------------- Review center ---------------- */

const FILTERS: { id: string; label: string }[] = [
  { id: "due", label: "Due today" },
  { id: "weak", label: "Weak" },
  { id: "struggling", label: "Struggling" },
  { id: "fresh", label: "Recently learned" },
  { id: "mastered", label: "Mastered" },
  { id: "medical", label: "Medical" },
  { id: "everyday", label: "Everyday" },
  { id: "favorites", label: "Favorites" },
];

export function ReviewCenter() {
  const { phrases, data, startPractice } = useApp();
  const [active, setActive] = useState<Set<string>>(new Set(["due"]));
  const now = Date.now();

  const match = (p: Phrase, f: string): boolean => {
    const pr = data.progress[p.id];
    switch (f) {
      case "due": return !!pr && pr.nextReview !== undefined && pr.nextReview <= now;
      case "weak": return !!pr && pr.timesSeen > 0 && pr.mastery < 40;
      case "struggling": return getState(pr) === "STRUGGLING";
      case "fresh": return !!pr && !!pr.firstLearned && now - pr.firstLearned < 3 * 86_400_000;
      case "mastered": return (pr?.mastery ?? 0) >= 75;
      case "medical": return p.domain === "medical";
      case "everyday": return p.domain === "everyday";
      case "favorites": return data.favorites.includes(p.id);
      default: return true;
    }
  };

  const list = useMemo(
    () => phrases.filter((p) => [...active].every((f) => match(p, f))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phrases, data.progress, data.favorites, active],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.id] = phrases.filter((p) => match(p, f.id)).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases, data.progress, data.favorites]);

  const toggle = (id: string) => {
    setActive((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n.size ? n : new Set([id]);
    });
  };

  const start = () => {
    const items = buildReviewPlan(list.map((p) => p.id), phrases, data.progress, data.settings).slice(0, 24);
    startPractice({
      title: "Custom review",
      subtitle: `${items.length} phrases · your filters, your pace`,
      mode: "review",
      items,
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <div className="anim-rise">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Review center</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Target exactly what your memory needs.</h1>
        <p className="mt-1 max-w-2xl text-sm text-mute dark:text-faint">
          Stack filters to build a custom drill. Reviews here feed the same spaced-repetition engine — nothing gets out of sync.
        </p>
      </div>

      <div className="anim-rise mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const on = active.has(f.id);
          return (
            <button key={f.id} onClick={() => toggle(f.id)}
              className={cx("btn-press focus-ring rounded-xl border-2 px-3.5 py-2 text-sm font-semibold transition-colors",
                on ? "border-pine-500 bg-pine-600 text-white shadow-lift" : "border-line bg-panel text-mute hover:border-pine-300 dark:border-nline dark:bg-carbon dark:text-faint")}>
              {f.label} <span className={cx("ml-1 font-mono text-[11px]", on ? "text-pine-100" : "text-faint")}>{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      <Card className="anim-rise mt-5 flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-extrabold">{list.length} phrase{list.length === 1 ? "" : "s"} selected</p>
          <p className="text-sm text-mute dark:text-faint">Mixed exercise types, ordered by weakness. Estimated {Math.max(2, Math.round(list.length * 0.8))} min.</p>
        </div>
        <Button size="lg" onClick={start} disabled={!list.length}><Play size={16} /> Start review</Button>
      </Card>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {list.slice(0, 14).map((p) => {
          const pr = data.progress[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5 dark:border-nline dark:bg-carbon">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.en}</p>
                <p className="truncate text-xs text-faint" dir="auto">{p.es}</p>
              </div>
              <StateChip state={getState(pr)} />
              <span className="w-24"><ProgressBar value={pr?.mastery ?? 0} className="h-1.5" /></span>
            </div>
          );
        })}
        {list.length > 14 && <p className="text-xs text-faint sm:col-span-2">…and {list.length - 14} more in the session queue.</p>}
      </div>

    </div>
  );
}
