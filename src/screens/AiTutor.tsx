import { useEffect, useRef, useState } from "react";
import { useApp } from "../store";
import { askTutor } from "../lib/ai";
import type { AiMsg } from "../lib/types";
import { cx } from "../ui";
import { Bot, Send, Sparkles, Trash2, X } from "lucide-react";

const INTRO: AiMsg = {
  role: "assistant",
  content:
    "Soy tu tutor de inglés. Pregúntame por cualquier frase del curso — significado, patrón, pronunciación o cuándo usarla.\n\nSi conectas un proveedor en Settings (Groq, OpenAI, Ollama…), respondo con ese modelo; si no, uso el tutor local.",
  t: 0,
};

const SUGGESTIONS = [
  "¿Cuándo uso “I'll take care of it”?",
  "Explica “No cap.”",
  "¿Qué digo en una llamada con el laboratorio?",
];

export function AiTutor() {
  const { data, phrases, setAiChat, practice } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const msgs = data.aiChat.length ? data.aiChat : [INTRO];
  const cfg = data.settings.ai;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [open, msgs.length, thinking]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setInput("");
    const userMsg: AiMsg = { role: "user", content: q, t: Date.now() };
    const history = [...data.aiChat, userMsg];
    setAiChat(history);
    setThinking(true);
    const { text: reply } = await askTutor(cfg, data.aiChat, q, phrases, data.progress);
    setAiChat([...history, { role: "assistant", content: reply, t: Date.now() }]);
    setThinking(false);
  };

  if (practice) return null;

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "btn-press focus-ring fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-13 w-13 items-center justify-center rounded-full shadow-pop lg:bottom-6 lg:right-6",
          open ? "bg-ink text-paper dark:bg-snow dark:text-night" : "bg-clay-500 text-white hover:bg-clay-600",
        )}
        style={{ height: 52, width: 52 }}
        aria-label="Abrir tutor IA"
      >
        {open ? <X size={20} /> : (
          <span className="relative">
            <Bot size={22} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-gold-300 streak-live" />
          </span>
        )}
      </button>

      {open && (
        <div className="anim-pop fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-2 z-40 flex max-h-[calc(100dvh-7rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-pop lg:bottom-24 lg:right-6 dark:border-nline dark:bg-carbon">
          {/* header */}
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 dark:border-nline">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-clay-500 text-white"><Bot size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-extrabold leading-tight">Tutor IA</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-faint">
                {cfg.provider === "custom" && cfg.baseUrl ? cfg.model || "modelo personalizado" : "tutor local · offline"}
              </p>
            </div>
            <button onClick={() => setAiChat([])} className="btn-press focus-ring rounded-lg p-1.5 text-faint hover:text-clay-500" aria-label="Borrar conversación">
              <Trash2 size={14} />
            </button>
            <button onClick={() => setOpen(false)} className="btn-press focus-ring rounded-lg p-1.5 text-faint hover:text-ink dark:hover:text-snow" aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>

          {/* messages */}
          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={cx("anim-ticker flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx(
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-md bg-pine-600 text-white"
                    : "rounded-bl-md border border-line bg-paper text-ink dark:border-nline dark:bg-night dark:text-snow",
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-paper px-4 py-3 dark:border-nline dark:bg-night">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="eq-bar h-3 w-1 rounded-full bg-pine-500" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* suggestions */}
          {data.aiChat.length === 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="btn-press focus-ring flex items-center gap-1 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-mute hover:border-pine-300 hover:text-pine-700 dark:border-nline dark:bg-carbon2 dark:text-faint dark:hover:text-pine-300">
                  <Sparkles size={10} /> {s}
                </button>
              ))}
            </div>
          )}

          {/* input */}
          <div className="border-t border-line p-3 dark:border-nline">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                rows={1}
                placeholder="Pregunta en español o inglés…"
                className="focus-ring max-h-24 min-h-10 flex-1 resize-none rounded-xl border-2 border-line bg-paper/60 px-3 py-2.5 text-sm focus:border-clay-400 dark:border-nline dark:bg-night/60"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || thinking}
                className="btn-press focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay-500 text-white hover:bg-clay-600 disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
