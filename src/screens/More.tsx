import { useState } from "react";
import { useApp } from "../store";
import { ACHIEVEMENTS } from "../lib/data";
import { computeStats } from "../lib/engine";
import { BarChart, Button, Card, Chip, Modal, ProgressBar, Segmented, StatDelta, Toggle, cx } from "../ui";
import {
  Award, BookOpen, CalendarDays, Clock, Download, Ear, Flame, HeartPulse, LogOut, MessagesSquare,
  Moon, RotateCcw, Target, TrendingUp, Trophy, Upload, UserRound, Zap,
} from "lucide-react";

/* ---------------- History ---------------- */

export function History() {
  const { data, phrases } = useApp();
  const stats = computeStats(data, phrases);
  const sessions = [...data.history].reverse();
  const totalMin = data.history.reduce((s, h) => s + h.minutes, 0);
  const totalNew = data.history.reduce((s, h) => s + h.newLearned.length, 0);
  const totalMastered = data.history.reduce((s, h) => s + h.mastered.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <div className="anim-rise">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Study history</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Proof of work.</h1>
        <p className="mt-1 text-sm text-mute dark:text-faint">{data.history.length} sessions · {Math.round(totalMin / 60)}h {totalMin % 60}m total · {totalNew} phrases learned · {totalMastered} mastery milestones</p>
      </div>

      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Target size={16} />} label="Overall accuracy" value={`${stats.accuracy || "—"}%`} />
        <MetricCard icon={<TrendingUp size={16} />} label="Production accuracy" value={`${stats.productionAccuracy || "—"}%`} />
        <MetricCard icon={<Ear size={16} />} label="Listening accuracy" value={`${stats.listeningAccuracy || "—"}%`} />
        <MetricCard icon={<MessagesSquare size={16} />} label="Speaking accuracy" value={`${stats.speakingAccuracy || "—"}%`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="anim-rise p-5 lg:col-span-2">
          <h3 className="mb-3 font-display text-base font-bold">Sessions</h3>
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-faint">No sessions yet — your first one is waiting on the dashboard.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto pr-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-panel text-left text-[10px] font-bold uppercase tracking-widest text-faint dark:bg-carbon">
                  <tr>
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Mode</th>
                    <th className="py-2 pr-2">Time</th>
                    <th className="py-2 pr-2">Ex.</th>
                    <th className="py-2 pr-2">Acc.</th>
                    <th className="py-2 pr-2">XP</th>
                    <th className="py-2">New</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-nline">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-paper/70 dark:hover:bg-night/50">
                      <td className="py-2 pr-2 font-medium">{new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="py-2 pr-2"><Chip className="!text-[10px] capitalize">{s.mode}</Chip></td>
                      <td className="py-2 pr-2">{s.minutes}m</td>
                      <td className="py-2 pr-2">{s.exercises}</td>
                      <td className="py-2 pr-2 font-mono font-bold">{Math.round(((s.correct + s.alt) / Math.max(1, s.exercises)) * 100)}%</td>
                      <td className="py-2 pr-2 font-mono font-bold text-gold-500">+{s.xp}</td>
                      <td className="py-2">{s.newLearned.length || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="anim-rise p-5">
            <h3 className="mb-3 font-display text-base font-bold">Mastered per week</h3>
            <BarChart values={stats.masteredPerWeek} labels={stats.masteredPerWeek.map((_, i) => `W${i + 1}`)} tone="gold" />
          </Card>
          <Card className="anim-rise p-5">
            <h3 className="mb-3 font-display text-base font-bold">Strongest &amp; weakest areas</h3>
            {stats.weakest.length === 0 ? (
              <p className="text-sm text-faint">Practice a bit more to unlock category insights.</p>
            ) : (
              <div className="space-y-2.5">
                {[...stats.strongest.slice(0, 2).map((c) => ({ ...c, up: true })), ...stats.weakest.slice(0, 2).map((c) => ({ ...c, up: false }))].map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{c.name}</span>
                      <StatDelta value={c.acc - 70} />
                    </div>
                    <ProgressBar value={c.acc} tone={c.up ? "pine" : "clay"} className="mt-1 h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="anim-rise p-5">
            <h3 className="mb-3 font-display text-base font-bold">Domain accuracy</h3>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs font-semibold"><span className="flex items-center gap-1"><BookOpen size={12} /> Everyday</span><span className="font-mono">{stats.everydayAccuracy || "—"}%</span></div>
                <ProgressBar value={stats.everydayAccuracy} className="mt-1 h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold"><span className="flex items-center gap-1"><HeartPulse size={12} /> Medical</span><span className="font-mono">{stats.medicalAccuracy || "—"}%</span></div>
                <ProgressBar value={stats.medicalAccuracy} tone="med" className="mt-1 h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold"><span className="flex items-center gap-1"><CalendarDays size={12} /> Delayed recall (7-day)</span><span className="font-mono">{stats.delayedAccuracy || "—"}%</span></div>
                <ProgressBar value={stats.delayedAccuracy} tone="gold" className="mt-1 h-1.5" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AchievementsBlock />
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-faint">{icon} {label}</p>
      <p className="mt-1.5 font-display text-3xl font-extrabold">{value}</p>
    </Card>
  );
}

function AchievementsBlock() {
  const { data } = useApp();
  const unlockedCount = Object.keys(data.achievements).length;
  return (
    <div className="anim-rise mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Achievements</h2>
        <Chip tone="gold"><Trophy size={11} /> {unlockedCount}/{ACHIEVEMENTS.length}</Chip>
      </div>
      <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const date = data.achievements[a.id];
          const done = !!date;
          return (
            <Card key={a.id} className={cx("p-4", !done && "opacity-55 grayscale")}>
              <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl", done ? "bg-gold-100 text-gold-600 dark:bg-gold-400/15 dark:text-gold-300" : "bg-paper text-faint dark:bg-carbon2")}>
                <Award size={19} />
              </span>
              <p className="mt-2.5 font-display text-sm font-bold">{a.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-mute dark:text-faint">{a.desc}</p>
              {done && <p className="mt-2 font-mono text-[10px] font-bold text-gold-600 dark:text-gold-300">{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */

export function Settings() {
  const { data, user, updateSettings, logout, importContent, toast, exportData, wipeProgress } = useApp();
  const s = data.settings;
  const [raw, setRaw] = useState("");
  const [wipeAsk, setWipeAsk] = useState(false);

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fluencia-progress.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Progress exported", "pine");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
      <div className="anim-rise">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-pine-600 dark:text-pine-300">Settings</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Tune the trainer.</h1>
      </div>

      <div className="mt-6 space-y-4">
        <Card className="anim-rise p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><Target size={16} className="text-pine-600 dark:text-pine-300" /> Daily goal</h3>
          <p className="mt-1 text-sm text-mute dark:text-faint">How much practice the dashboard plans for you each day.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([["Casual", 5], ["Regular", 10], ["Serious", 15], ["Intensive", 20]] as const).map(([label, m]) => (
              <button key={m} onClick={() => { updateSettings({ dailyGoalMinutes: m }); toast(`Daily goal set to ${m} minutes`); }}
                className={cx("btn-press focus-ring rounded-xl border-2 px-4 py-2.5 text-sm font-semibold",
                  s.dailyGoalMinutes === m ? "border-pine-500 bg-pine-600 text-white" : "border-line bg-panel text-mute hover:border-pine-300 dark:border-nline dark:bg-carbon")}>
                {label} · {m} min
              </button>
            ))}
          </div>
        </Card>

        <Card className="anim-rise p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><BookOpen size={16} className="text-pine-600 dark:text-pine-300" /> Learning</h3>
          <div className="mt-4 space-y-4">
            <Row label="New phrases per day" hint="Fresh phrases introduced in daily sessions.">
              <Segmented options={[{ id: "3", label: "3" }, { id: "6", label: "6" }, { id: "8", label: "8" }, { id: "12", label: "12" }]}
                value={String(s.newPerDay) as "3" | "6" | "8" | "12"}
                onChange={(v) => updateSettings({ newPerDay: Number(v) })} />
            </Row>
            <Row label="Primary focus" hint="Which phrases are prioritized when introducing new material.">
              <Segmented options={[{ id: "everyday", label: "Everyday" }, { id: "balanced", label: "Balanced" }, { id: "medical", label: "Medical" }]}
                value={s.focus} onChange={(v) => updateSettings({ focus: v })} />
            </Row>
            <Row label="Starting level" hint="Affects which difficulty tiers appear first.">
              <Segmented options={[{ id: "beginner", label: "Beginner" }, { id: "intermediate", label: "Intermediate" }, { id: "advanced", label: "Advanced" }]}
                value={s.level} onChange={(v) => updateSettings({ level: v })} />
            </Row>
            <Row label="Speaking exercises" hint="Mic-based practice. Disable if you'd rather self-assess.">
              <Toggle on={s.speakingEnabled} onChange={(v) => updateSettings({ speakingEnabled: v })} label="Speaking exercises" />
            </Row>
          </div>
        </Card>

        <Card className="anim-rise p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><Ear size={16} className="text-pine-600 dark:text-pine-300" /> Audio</h3>
          <div className="mt-4 space-y-4">
            <Row label="Auto-play audio" hint="Play the phrase as soon as a listening card appears.">
              <Toggle on={s.audioAutoplay} onChange={(v) => updateSettings({ audioAutoplay: v })} label="Audio autoplay" />
            </Row>
            <Row label="Default speed" hint="You can always switch to slow inside an exercise.">
              <Segmented options={[{ id: "normal", label: "Normal" }, { id: "slow", label: "Slow" }]}
                value={s.audioRate} onChange={(v) => updateSettings({ audioRate: v })} />
            </Row>
          </div>
        </Card>

        <Card className="anim-rise p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><Moon size={16} className="text-pine-600 dark:text-pine-300" /> Appearance</h3>
          <div className="mt-4">
            <Row label="Dark mode" hint="Easier on the eyes for late-night reviews.">
              <Toggle on={s.darkMode} onChange={(v) => updateSettings({ darkMode: v })} label="Dark mode" />
            </Row>
          </div>
        </Card>

        <Card className="anim-rise p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><Upload size={16} className="text-pine-600 dark:text-pine-300" /> Content — add phrases</h3>
          <p className="mt-1 text-sm text-mute dark:text-faint">
            The curriculum is data-driven: paste a JSON array (<code className="font-mono text-xs">[&#123;"en": "…", "es": "…", "module": 1, "domain": "everyday"&#125;]</code>)
            or a CSV with headers <code className="font-mono text-xs">en,es,module,category,domain</code>. Import scales to thousands of phrases without code changes.
          </p>
          <textarea
            value={raw} onChange={(e) => setRaw(e.target.value)} rows={5}
            placeholder={'[\n  { "en": "I owe you one.", "es": "Te debo una.", "module": 5, "domain": "everyday" }\n]'}
            className="focus-ring mt-3 w-full resize-y rounded-xl border-2 border-line bg-paper/60 px-3 py-2.5 font-mono text-xs focus:border-pine-500 dark:border-nline dark:bg-night/60"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => {
              const r = importContent(raw);
              if (r.ok) { toast(`Imported ${r.count} phrase${r.count === 1 ? "" : "s"}`, "pine"); setRaw(""); }
              else toast(r.error ?? "Import failed", "clay");
            }} disabled={!raw.trim()}><Upload size={13} /> Import</Button>
            <Button size="sm" variant="outline" onClick={download}><Download size={13} /> Export my progress</Button>
          </div>
          <p className="mt-2 text-xs text-faint">{data.customPhrases.length} custom phrase{data.customPhrases.length === 1 ? "" : "s"} currently in your library.</p>
        </Card>

        <Card className="anim-rise p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><UserRound size={16} className="text-pine-600 dark:text-pine-300" /> Account</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-mute dark:text-faint">{user?.email}{user?.demo ? " · demo account" : ""}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setWipeAsk(true)}><RotateCcw size={13} /> Reset all progress</Button>
            <Button size="sm" variant="danger" onClick={logout}><LogOut size={13} /> Log out</Button>
          </div>
        </Card>
      </div>

      <Modal open={wipeAsk} onClose={() => setWipeAsk(false)}>
        <h3 className="font-display text-xl font-bold">Reset all learning progress?</h3>
        <p className="mt-1 text-sm text-mute dark:text-faint">Mastery scores, schedules, history and streaks will be cleared for this account. Custom phrases and settings stay.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setWipeAsk(false)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={() => { wipeProgress(); setWipeAsk(false); toast("Progress reset — fresh start", "clay"); }}>Reset everything</Button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-mute dark:text-faint">{hint}</p>
      </div>
      {children}
    </div>
  );
}
