import type { AiMsg, AiSettings, Phrase, PhraseProgress } from "./types";

/* ============================================================
   AI TUTOR LAYER
   Provider "local"  → rule-based expert tutor, works offline.
   Provider "custom" → any OpenAI-compatible /chat/completions
                       endpoint (OpenAI, Groq, OpenRouter,
                       Ollama, LM Studio…). Falls back to the
                       local tutor automatically on errors.
   ============================================================ */

export const AI_SYSTEM_PROMPT =
  "Eres un tutor experto en inglés americano, conciso y directo. " +
  "Explicas en español breve, corriges mostrando el patrón exacto (ej: 'take care OF + objeto'), " +
  "distingues entre incorrecto / comprensible pero poco natural / natural / muy natural, " +
  "y siempre ofreces la versión que diría un nativo. Nada de rodeos ni entusiasmo excesivo.";

/* ---------------- local expert tutor ---------------- */

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ' ]/g, " ").replace(/\s+/g, " ").trim();
}

function findPhrase(q: string, phrases: Phrase[]): Phrase | null {
  const nq = norm(q);
  let best: Phrase | null = null;
  let bestScore = 0;
  for (const p of phrases) {
    const en = norm(p.en);
    const es = norm(p.es);
    let score = 0;
    if (nq.includes(en) || en.includes(nq)) score = 100;
    else if (nq.includes(es) || es.includes(nq)) score = 80;
    else {
      const words = en.split(" ").filter((w) => w.length > 3);
      const hit = words.filter((w) => nq.includes(w)).length;
      if (words.length && hit / words.length >= 0.6) score = Math.round((hit / words.length) * 70);
    }
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return bestScore >= 60 ? best : null;
}

function phraseExplanation(p: Phrase, progress?: PhraseProgress): string {
  const lines = [
    `**“${p.en}”**`,
    `Significa: ${p.es} (también: ${p.alt}).`,
    `Patrón: ${p.grammar}`,
    `Ejemplo: “${p.example}”`,
  ];
  if (p.mistakes) lines.push(`Ojo: ${p.mistakes}`);
  if (progress && progress.mastery > 0) lines.push(`Tu dominio actual: ${Math.round(progress.mastery)}%.`);
  return lines.join("\n");
}

export function localTutorReply(q: string, phrases: Phrase[], progress: Record<string, PhraseProgress>): string {
  const nq = norm(q);

  if (/pronun|acento|speak|hablar/.test(nq)) {
    return [
      "Para sonar más natural en inglés americano:",
      "1. Une las palabras: “take care of it” suena /teik-ker-of-it/, no palabra por palabra.",
      "2. La sílaba fuerte lleva el ritmo: I'll TAKE care of IT.",
      "3. Usa el laboratorio de pronunciación en la sección Calle: escuchas, repites y te evalúo palabra por palabra.",
    ].join("\n");
  }

  if (/diferencia|vs\b|versus|compara/.test(nq)) {
    const a = findPhrase(q, phrases);
    if (a) return phraseExplanation(a, progress[a.id]) + "\n\nSi querías comparar dos frases, escríbeme una y luego la otra.";
    return "Dime qué dos expresiones quieres comparar y te explico el matiz entre ellas.";
  }

  if (/medic|doctor|pacient|patient|clinic/.test(nq) && !findPhrase(q, phrases)) {
    const meds = phrases.filter((p) => p.domain === "medical").slice(0, 4);
    return "Inglés médico clave para empezar:\n" + meds.map((p) => `• “${p.en}” — ${p.es}`).join("\n") +
      "\n\nPregúntame por cualquiera y te doy el patrón completo.";
  }

  const p = findPhrase(q, phrases);
  if (p) return phraseExplanation(p, progress[p.id]);

  if (/hola|buenas|hey|hi\b|hello/.test(nq)) {
    return "¡Hola! Soy tu tutor de inglés. Pregúntame por cualquier frase del curso: significado, patrón, pronunciación o cuándo usarla.";
  }

  const pick = phrases.filter((x) => x.mistakes)[Math.floor(Math.random() * Math.min(8, phrases.length))];
  return [
    "No encontré esa frase en el curso, pero puedo ayudarte así:",
    "• Escribe una frase en inglés o español y te explico su patrón.",
    "• Pregunta por pronunciación, diferencias entre expresiones o inglés médico.",
    pick ? `\nFrase del momento: ${phraseExplanation(pick, progress[pick.id])}` : "",
  ].filter(Boolean).join("\n");
}

/* ---------------- custom OpenAI-compatible provider ---------------- */

export async function askCustom(cfg: AiSettings, history: AiMsg[], question: string): Promise<string> {
  let endpoint = cfg.baseUrl.trim().replace(/\/+$/, "");
  if (!endpoint) throw new Error("Falta la URL del proveedor");
  if (!endpoint.endsWith("/chat/completions")) {
    endpoint = `${endpoint}/chat/completions`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model || "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: question },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) throw new Error("Respuesta vacía");
    return String(text);
  } finally {
    clearTimeout(timer);
  }
}

export async function askTutor(
  cfg: AiSettings,
  history: AiMsg[],
  question: string,
  phrases: Phrase[],
  progress: Record<string, PhraseProgress>,
): Promise<{ text: string; provider: "local" | "custom" }> {
  if (cfg.provider === "custom" && cfg.baseUrl.trim()) {
    try {
      const text = await askCustom(cfg, history, question);
      return { text, provider: "custom" };
    } catch (e) {
      const fallback = localTutorReply(question, phrases, progress);
      const why = e instanceof Error && e.name === "AbortError" ? "tiempo de espera agotado" : e instanceof Error ? e.message : "error de conexión";
      return {
        text: `⚠️ No pude conectar con tu proveedor (${why}). Mientras tanto, tutor local:\n\n${fallback}`,
        provider: "local",
      };
    }
  }
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));
  return { text: localTutorReply(question, phrases, progress), provider: "local" };
}
