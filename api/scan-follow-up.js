import { getAuthenticatedUser } from "../lib/request-auth.js";

export const config = {
  maxDuration: 45
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(501).json({ error: "OPENAI_API_KEY fehlt. Lege ihn in Vercel unter Environment Variables an." });
  }

  try {
    await getAuthenticatedUser(req, { required: true });
    const { question, context } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const cleanQuestion = String(question || "").trim();
    if (cleanQuestion.length < 2) return res.status(400).json({ error: "Bitte stelle eine konkrete Frage." });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(40000),
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        max_output_tokens: 420,
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "Du bist der Rückfragen-Assistent einer deutschen vegetarisch/veganen Food-App.",
              "Beantworte nur Fragen zum übergebenen Scan-Kontext. Erfinde keine Zutaten.",
              "Wenn die Antwort aus dem Kontext nicht sicher ableitbar ist, sage das klar und kurz.",
              "Antworte auf Deutsch, hilfreich, knapp und alltagstauglich.",
              "",
              `Scan-Kontext JSON: ${JSON.stringify(context || {}).slice(0, 6000)}`,
              "",
              `Frage: ${cleanQuestion}`
            ].join("\n")
          }]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "OpenAI request failed" });
    const answer = extractResponseText(data);
    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error instanceof Error ? error.message : "Rückfrage nicht erreichbar." });
  }
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  const walk = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value !== "object") return;
    if ((value.type === "output_text" || value.type === "text") && typeof value.text === "string") chunks.push(value.text);
    if (typeof value.content === "string") chunks.push(value.content);
    Object.values(value).forEach(walk);
  };
  walk(data.output);
  return chunks.join("\n").trim();
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
}
