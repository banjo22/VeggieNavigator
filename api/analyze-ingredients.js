import { consumeScanQuota } from "../lib/scan-limits.js";
import { getAuthenticatedUser } from "../lib/request-auth.js";

export const config = {
  maxDuration: 90,
};

const menuResponseFormat = {
  type: "json_schema",
  name: "menu_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["language", "dishes", "generalNotes"],
    properties: {
      language: { type: "string" },
      dishes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "description",
            "classification",
            "reason",
            "problematicIngredients",
            "adaptationSuggestion",
            "questionForRestaurant",
            "questionForRestaurantGerman",
            "questionForRestaurantLocal",
            "questionForRestaurantEnglish",
          ],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            classification: {
              type: "string",
              enum: [
                "vegan",
                "vegetarian",
                "not_suitable",
                "possibly_adaptable",
                "unclear",
              ],
            },
            reason: { type: "string" },
            problematicIngredients: {
              type: "array",
              items: { type: "string" },
            },
            adaptationSuggestion: { type: "string" },
            questionForRestaurant: { type: "string" },
            questionForRestaurantGerman: { type: "string" },
            questionForRestaurantLocal: { type: "string" },
            questionForRestaurantEnglish: { type: "string" },
          },
        },
      },
      generalNotes: { type: "array", items: { type: "string" } },
    },
  },
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST required" });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(501).json({
      error:
        "OPENAI_API_KEY fehlt. Lege ihn in Vercel unter Environment Variables an.",
    });
  }

  try {
    await getAuthenticatedUser(req, { required: true });
    const {
      imageDataUrl,
      imageDataUrls,
      mode = "ingredients",
      diet = "vegan",
      exclusions = [],
      userLanguage = "de",
    } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const isMenu = mode === "menu";
    if (!["ingredients", "menu"].includes(mode))
      return res.status(400).json({ error: "Ungültiger Analysemodus." });
    const images = isMenu
      ? normalizeImages(imageDataUrls || imageDataUrl)
      : normalizeImages(imageDataUrl).slice(0, 1);
    if (images.length === 0)
      return res.status(400).json({
        error:
          "Bitte lade mindestens ein Bild hoch oder fotografiere eine Seite.",
      });
    if (images.some((image) => image.length > 8_000_000))
      return res.status(413).json({
        error:
          "Ein Bild ist zu groß. Bitte komprimiere es auf weniger als 6 MB.",
      });
    let quota;
    try {
      quota = await consumeScanQuota(req);
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || "Scan-Limit konnte nicht geprüft werden.",
        quota: error.quota,
      });
    }

    const prompt = isMenu
      ? [
          "Analysiere ausschliesslich die sichtbare Speisekarte in allen Bildern. Die Bilder können mehrere Seiten derselben Speisekarte sein.",
          "Fasse die Seiten zusammen und vermeide doppelte Gerichte.",
          "Erfinde keine Gerichte.",
          "Wenn ein Gericht nicht lesbar ist, lass es weg.",
          "Wenn vor einem Gericht eine Nummer steht, übernimm die Nummer zur Orientierung, z.B. '12 Pasta Arrabbiata'.",
          `Die Sprache des Users ist: ${userLanguage === "de" ? "Deutsch" : String(userLanguage).slice(0, 20)}. Alle Erklärungen für den User müssen auf Deutsch sein. Das gilt insbesondere für description, reason, problematicIngredients, adaptationSuggestion und generalNotes.`,
          "Behalte im Feld name den originalen Namen des Gerichts von der Speisekarte bei, damit der User es wiederfindet.",
          "Erkenne die hauptsächliche Sprache der Speisekarte und gib sie im Feld language als kurzen ISO-639-1-Code aus, zum Beispiel de, en, it, es oder fr.",
          `Das Ernährungsprofil ist: ${diet === "vegetarian" ? "vegetarisch" : diet === "flexitarian" ? "flexitarisch mit Fokus auf pflanzliche Optionen" : "vegan"}.`,
          `Zusätzlich zu vermeiden: ${
            Array.isArray(exclusions) && exclusions.length
              ? exclusions
                  .map((item) => String(item).slice(0, 80))
                  .slice(0, 20)
                  .join(", ")
              : "keine weiteren Angaben"
          }.`,
          "Erfasse jedes lesbare Gericht, auch wenn es nicht direkt zum Profil passt.",
          "Markiere Gerichte als possibly_adaptable, wenn sie durch Weglassen oder Ersetzen einzelner Bestandteile zum Profil passen könnten.",
          "Nenne bei possibly_adaptable immer eine konkrete adaptationSuggestion und eine konkrete questionForRestaurant.",
          "Wenn bei einem Gericht keine Anpassung oder Restaurantfrage nötig ist, setze die entsprechenden Pflichtfelder auf einen leeren String.",
          "questionForRestaurantGerman ist immer eine natürliche deutsche Frage, die der User dem Restaurant stellen kann.",
          "questionForRestaurantEnglish ist immer eine natürliche englische Übersetzung derselben Frage.",
          "Wenn die Speisekarte Deutsch ist, setze questionForRestaurant und questionForRestaurantGerman auf dieselbe deutsche Frage und questionForRestaurantLocal auf einen leeren String.",
          "Wenn die Speisekarte nicht Deutsch ist, setze questionForRestaurantLocal auf eine natürliche Übersetzung der deutschen Frage in die Sprache der Speisekarte. Setze questionForRestaurant auf dieselbe fremdsprachige Frage, damit sie im Restaurant direkt vorgezeigt werden kann.",
          "Markiere ein Gericht nur dann als vegan, wenn die sichtbaren Angaben eindeutig sind. Nutze sonst unclear.",
          "Gib selbst bei Unsicherheit jedes lesbare Gericht aus und erkläre die Unsicherheit im reason-Feld.",
        ].join("\n")
      : [
          "Analysiere diese Zutatenliste für eine deutsche vegetarische/vegane Food-App.",
          "Antworte in allen Freitextfeldern auf Deutsch, unabhängig von der Sprache auf der Verpackung.",
          "Lies die sichtbaren Zutaten so vollständig wie möglich aus.",
          "Antworte ausschliesslich als valides JSON ohne Markdown.",
          "Pflichtschema: {classification:'vegan'|'vegetarian'|'not_suitable'|'unclear',confidence:'high'|'medium'|'low',productName?:string,brand?:string,detectedText?:string,summary:string,detectedIngredients:Array<{name:string,normalizedName?:string,status:'suitable'|'problematic'|'unclear',reason?:string}>,problematicIngredients:Array<{name:string,reason:string,sourceType?:'animal'|'possibly_animal'|'other'}>,possibleAllergens:string[],uncertainties:string[],suggestedAlternatives:Array<{name:string,reason:string}>}.",
          "Nenne Unsicherheiten ausdrücklich. Erfinde keine Produktdaten, Allergensicherheit oder Alternativen.",
        ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(85000),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        max_output_tokens: isMenu ? 4000 : 1200,
        ...(isMenu ? { text: { format: menuResponseFormat } } : {}),
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              ...images.map((image) => ({
                type: "input_image",
                image_url: image,
              })),
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok)
      return res
        .status(response.status)
        .json({ error: data.error?.message || "OpenAI request failed" });

    const text = extractResponseText(data);
    if (!text)
      return res.status(502).json({
        error:
          "OpenAI hat keine lesbare Analyse zurückgegeben. Bitte Bild erneut versuchen.",
      });
    if (isMenu) {
      const result = validateMenuResult(safeJson(text));
      if (result.dishes.length === 0)
        return res.status(422).json({
          error:
            "Auf den Bildern konnten keine einzelnen Gerichte sicher gelesen werden. Bitte fotografiere die Speisekarte näher, gerade und mit gutem Licht.",
          quota,
        });
      return res.status(200).json({
        result,
        source: "OpenAI Responses API",
        quota,
      });
    }
    return res.status(200).json({
      result: validateIngredientResult(safeJson(text)),
      source: "OpenAI Responses API",
      quota,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error:
        error instanceof Error ? error.message : "KI-Analyse nicht erreichbar.",
    });
  }
}

function safeJson(text) {
  try {
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    return JSON.parse(
      start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned,
    );
  } catch {
    return {
      status: "unklar",
      explanation: text || "Keine auswertbare Antwort erhalten.",
      problematicIngredients: [],
      detectedIngredients: [],
      confidence: 0,
    };
  }
}

function normalizeImages(value) {
  if (Array.isArray(value)) return value.filter(isImageInput).slice(0, 8);
  if (isImageInput(value)) return [value];
  return [];
}

export function validateIngredientResult(value) {
  const allowed = new Set(["vegan", "vegetarian", "not_suitable", "unclear"]);
  const confidenceAllowed = new Set(["high", "medium", "low"]);
  return {
    classification: allowed.has(value?.classification)
      ? value.classification
      : "unclear",
    confidence: confidenceAllowed.has(value?.confidence)
      ? value.confidence
      : "low",
    ...(typeof value?.productName === "string"
      ? { productName: value.productName.slice(0, 200) }
      : {}),
    ...(typeof value?.brand === "string"
      ? { brand: value.brand.slice(0, 160) }
      : {}),
    detectedText:
      typeof value?.detectedText === "string"
        ? value.detectedText.slice(0, 8000)
        : "",
    summary:
      typeof value?.summary === "string"
        ? value.summary.slice(0, 1200)
        : "Die Analyse war nicht eindeutig.",
    detectedIngredients: cleanIngredientObjects(value?.detectedIngredients),
    problematicIngredients: cleanProblematicObjects(
      value?.problematicIngredients,
    ),
    possibleAllergens: cleanStrings(value?.possibleAllergens),
    uncertainties: cleanStrings(value?.uncertainties),
    suggestedAlternatives: cleanAlternatives(value?.suggestedAlternatives),
  };
}

function cleanIngredientObjects(value) {
  return Array.isArray(value)
    ? value.slice(0, 150).flatMap((item) =>
        item && typeof item === "object" && typeof item.name === "string"
          ? [
              {
                name: item.name.slice(0, 200),
                ...(typeof item.normalizedName === "string"
                  ? { normalizedName: item.normalizedName.slice(0, 200) }
                  : {}),
                status: ["suitable", "problematic", "unclear"].includes(
                  item.status,
                )
                  ? item.status
                  : "unclear",
                ...(typeof item.reason === "string"
                  ? { reason: item.reason.slice(0, 500) }
                  : {}),
              },
            ]
          : [],
      )
    : [];
}
function cleanProblematicObjects(value) {
  return Array.isArray(value)
    ? value.slice(0, 100).flatMap((item) =>
        item && typeof item === "object" && typeof item.name === "string"
          ? [
              {
                name: item.name.slice(0, 200),
                reason: String(
                  item.reason || "Nicht eindeutig geeignet.",
                ).slice(0, 500),
                sourceType: ["animal", "possibly_animal", "other"].includes(
                  item.sourceType,
                )
                  ? item.sourceType
                  : "other",
              },
            ]
          : [],
      )
    : [];
}
function cleanAlternatives(value) {
  return Array.isArray(value)
    ? value.slice(0, 20).flatMap((item) =>
        item && typeof item === "object" && typeof item.name === "string"
          ? [
              {
                name: item.name.slice(0, 200),
                reason: String(item.reason || "Pflanzliche Alternative").slice(
                  0,
                  500,
                ),
              },
            ]
          : [],
      )
    : [];
}

export function validateMenuResult(value) {
  const allowed = new Set([
    "vegan",
    "vegetarian",
    "not_suitable",
    "possibly_adaptable",
    "unclear",
  ]);
  const dishes = Array.isArray(value?.dishes)
    ? value.dishes.slice(0, 80).map((dish) => ({
        name: String(dish?.name || "Unleserliches Gericht").slice(0, 160),
        ...(typeof dish?.description === "string"
          ? { description: dish.description.slice(0, 500) }
          : {}),
        classification: allowed.has(dish?.classification)
          ? dish.classification
          : "unclear",
        reason: String(
          dish?.reason || "Die Angaben sind nicht eindeutig.",
        ).slice(0, 800),
        problematicIngredients: cleanStrings(dish?.problematicIngredients),
        ...(typeof dish?.adaptationSuggestion === "string"
          ? { adaptationSuggestion: dish.adaptationSuggestion.slice(0, 500) }
          : {}),
        ...(typeof dish?.questionForRestaurant === "string"
          ? { questionForRestaurant: dish.questionForRestaurant.slice(0, 500) }
          : {}),
        ...(typeof dish?.questionForRestaurantGerman === "string"
          ? {
              questionForRestaurantGerman:
                dish.questionForRestaurantGerman.slice(0, 500),
            }
          : {}),
        ...(typeof dish?.questionForRestaurantLocal === "string"
          ? {
              questionForRestaurantLocal: dish.questionForRestaurantLocal.slice(
                0,
                500,
              ),
            }
          : {}),
        ...(typeof dish?.questionForRestaurantEnglish === "string"
          ? {
              questionForRestaurantEnglish:
                dish.questionForRestaurantEnglish.slice(0, 500),
            }
          : {}),
      }))
    : [];
  return {
    ...(typeof value?.language === "string"
      ? { language: value.language.slice(0, 40) }
      : {}),
    dishes,
    generalNotes: cleanStrings(value?.generalNotes),
  };
}

function cleanStrings(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .slice(0, 100)
        .map((item) => item.slice(0, 300))
    : [];
}

function isImageInput(value) {
  return (
    typeof value === "string" &&
    (value.startsWith("data:image/") ||
      value.startsWith("https://") ||
      value.startsWith("http://"))
  );
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim())
    return data.output_text.trim();
  const chunks = [];
  const walk = (value) => {
    if (!value) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      if (
        (value.type === "output_text" || value.type === "text") &&
        typeof value.text === "string"
      )
        chunks.push(value.text);
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
