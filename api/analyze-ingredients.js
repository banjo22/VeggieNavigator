import { consumeScanQuota } from "../lib/scan-limits.js";

export const config = {
  maxDuration: 90
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(501).json({ error: "OPENAI_API_KEY fehlt. Lege ihn in Vercel unter Environment Variables an." });
  }

  try {
    const { imageDataUrl, imageDataUrls, mode = "ingredients" } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const isMenu = mode === "menu";
    const images = isMenu ? normalizeImages(imageDataUrls || imageDataUrl) : normalizeImages(imageDataUrl).slice(0, 1);
    if (images.length === 0) return res.status(400).json({ error: "Bitte lade mindestens ein Bild hoch oder fotografiere eine Seite." });
    let quota;
    try {
      quota = await consumeScanQuota(req);
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || "Scan-Limit konnte nicht geprueft werden.",
        quota: error.quota
      });
    }

    const prompt = isMenu
      ? [
          "Analysiere ausschliesslich die sichtbare Speisekarte in allen Bildern. Die Bilder koennen mehrere Seiten derselben Speisekarte sein.",
          "Fasse die Seiten zusammen und vermeide doppelte Gerichte.",
          "Erfinde keine Gerichte.",
          "Wenn ein Gericht nicht lesbar ist, lass es weg.",
          "Wenn vor einem Gericht eine Nummer steht, uebernimm die Nummer zur Orientierung, z.B. '12 Pasta Arrabbiata'.",
          "Gib nur kurzen deutschen Plain-Text aus, keine JSON, kein {}, keine Einleitung.",
          "Format:",
          "Vegan:",
          "- Gericht",
          "Vegetarisch:",
          "- Gericht",
          "Anpassbar:",
          "- Gericht -> Aenderung, damit vegan/vegetarisch",
          "Wenn eine Kategorie leer ist: '- nichts gefunden'."
        ].join("\n")
      : "Analysiere diese Zutatenliste fuer eine junge deutsche veggie/vegane Food-App. Antworte ausschliesslich als valides JSON ohne Markdown mit den Feldern status (vegan|vegetarisch|nicht veggie|unklar), explanation, problematicIngredients Array, confidence 0-1.";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(85000),
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        max_output_tokens: isMenu ? 650 : 350,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...images.map((image) => ({ type: "input_image", image_url: image }))
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "OpenAI request failed" });

    const text = extractResponseText(data);
    if (!text) return res.status(502).json({ error: "OpenAI hat keine lesbare Analyse zurueckgegeben. Bitte Bild erneut versuchen." });
    if (isMenu) return res.status(200).json({ result: { text }, raw: text, source: "OpenAI Responses API", quota });
    return res.status(200).json({ result: safeJson(text), raw: text, source: "OpenAI Responses API", quota });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "KI-Analyse nicht erreichbar." });
  }
}

function safeJson(text) {
  try {
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    return JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return {
      status: "unklar",
      explanation: text || "Keine auswertbare Antwort erhalten.",
      problematicIngredients: [],
      confidence: 0
    };
  }
}

function normalizeImages(value) {
  if (Array.isArray(value)) return value.filter(isImageInput).slice(0, 8);
  if (isImageInput(value)) return [value];
  return [];
}

function isImageInput(value) {
  return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("https://") || value.startsWith("http://"));
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  const walk = (value) => {
    if (!value) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      if ((value.type === "output_text" || value.type === "text") && typeof value.text === "string") chunks.push(value.text);
      if (typeof value.content === "string") chunks.push(value.content);
      Object.values(value).forEach(walk);
    }
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
