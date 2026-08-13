import { consumeScanQuota } from "../lib/scan-limits.js";
import { getAuthenticatedUser } from "../lib/request-auth.js";

export const config = {
  maxDuration: 55,
};

const menuExtractionFormat = {
  type: "json_schema",
  name: "menu_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["language", "dishes"],
    properties: {
      language: { type: "string" },
      dishes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
        },
      },
    },
  },
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

    if (isMenu) {
      const menuPrompt = [
        "Analysiere die sichtbare Speisekarte in einem einzigen Durchgang.",
        "Bilde zuerst intern eine vollständige Masterliste aller Gerichte und bewerte danach exakt diese Liste. Ein erkanntes Gericht darf bei Bewertung oder Übersetzung nicht verschwinden.",
        "Arbeite jede Seite systematisch von oben links nach unten rechts ab und prüfe vor der Ausgabe, ob zwischen dem ersten und letzten Gericht eine Zeile ausgelassen wurde.",
        "Ein Gericht ist ein einzeln bestellbarer Eintrag. Kategorien, Überschriften, Preise, Zutatenoptionen und Beilagen ohne eigenen bestellbaren Eintrag sind keine Gerichte.",
        "Fasse mehrere Seiten zusammen. Gib ein Gericht nur einmal aus, wenn derselbe Name mehrfach erscheint.",
        "Erfinde nichts. Übernimm Namen exakt in der Menüsprache und behalte vorhandene Nummern bei.",
        "description erklärt die sichtbare Beschreibung kurz auf Deutsch. Ist keine vorhanden, verwende einen leeren String.",
        "language ist der hauptsächliche ISO-639-1-Sprachcode der Karte, zum Beispiel de, en, it, es oder fr.",
        `Die Sprache des Users ist: ${userLanguage === "de" ? "Deutsch" : String(userLanguage).slice(0, 20)}. Alle Erklärungen für den User müssen auf Deutsch sein. Das gilt insbesondere für description, reason, problematicIngredients, adaptationSuggestion und generalNotes.`,
        `Das Ernährungsprofil ist: ${diet === "vegetarian" ? "vegetarisch" : diet === "flexitarian" ? "flexitarisch mit Fokus auf pflanzliche Optionen" : "vegan"}.`,
        `Zusätzlich zu vermeiden: ${
          Array.isArray(exclusions) && exclusions.length
            ? exclusions
                .map((item) => String(item).slice(0, 80))
                .slice(0, 20)
                .join(", ")
            : "keine weiteren Angaben"
        }.`,
        "Wende die folgende Klassifikation strikt und in dieser Priorität an; dieselben sichtbaren Angaben müssen immer zur selben Klasse führen.",
        "vegan: Das Gericht passt sicher zu einem veganen Profil und widerspricht keinen persönlichen Ausschlüssen.",
        "vegetarian: Das Gericht ist sicher vegetarisch, aber nicht vegan. Verwende diese Klasse nur, wenn das Profil vegetarisch oder flexitarisch ist und keine Ausschlüsse verletzt werden.",
        "possibly_adaptable: Das Gericht passt aktuell nicht zum Profil, kann aber durch das Weglassen oder Ersetzen von höchstens zwei klar benennbaren Bestandteilen passend werden.",
        "not_suitable: Das Gericht passt nicht und lässt sich nicht durch höchstens zwei einfache Änderungen passend machen.",
        "unclear: Die sichtbaren Angaben reichen für keine der vorigen Einstufungen. Vermutete typische Zutaten allein sind kein Beweis.",
        "Bei veganem Profil gilt ein vegetarisches Gericht mit leicht entfernbarer Milch, Butter, Sahne, Käse oder Ei als possibly_adaptable, nicht als vegetarian.",
        "Persönliche Ausschlüsse haben Vorrang vor vegan/vegetarisch. Ein sonst passendes Gericht ist possibly_adaptable, wenn der ausgeschlossene Bestandteil einfach entfernt werden kann, sonst not_suitable.",
        "Nenne bei possibly_adaptable immer eine konkrete adaptationSuggestion und eine konkrete questionForRestaurant.",
        "Wenn bei einem Gericht keine Anpassung oder Restaurantfrage nötig ist, setze die entsprechenden Pflichtfelder auf einen leeren String.",
        "questionForRestaurantGerman ist immer eine natürliche deutsche Frage, die der User dem Restaurant stellen kann.",
        "questionForRestaurantEnglish ist immer eine natürliche englische Übersetzung derselben Frage.",
        "questionForRestaurantLocal ist immer dieselbe Frage in der Sprache der Speisekarte, auch wenn diese Sprache Deutsch oder Englisch ist. Das Feld darf bei einer vorhandenen Restaurantfrage nicht leer sein.",
        "Setze questionForRestaurant immer auf denselben Text wie questionForRestaurantLocal, damit die Frage direkt im Restaurant gezeigt werden kann.",
        "Wenn die Speisekarte nicht Deutsch ist, setze questionForRestaurantLocal auf eine natürliche Übersetzung der deutschen Frage in die Sprache der Speisekarte. Setze questionForRestaurant auf dieselbe fremdsprachige Frage, damit sie im Restaurant direkt vorgezeigt werden kann.",
        "Markiere ein Gericht nur dann als vegan, wenn die sichtbaren Angaben eindeutig sind. Nutze sonst unclear.",
        "Wenn Angaben nicht reichen, behalte das Gericht und verwende unclear. Ein unsicheres Gericht darf niemals aus der Liste verschwinden.",
      ].join("\n");
      const menuData = await requestOpenAI({
        format: menuResponseFormat,
        maxOutputTokens: 4500,
        timeoutMs: 48000,
        content: [
          { type: "input_text", text: menuPrompt },
          ...images.map((image) => ({
            type: "input_image",
            image_url: image,
            detail: "high",
          })),
        ],
      });
      const result = validateMenuResult(
        safeJson(extractResponseText(menuData)),
      );
      if (result.dishes.length === 0)
        return res.status(422).json({
          error:
            "Auf den Bildern konnten innerhalb von 60 Sekunden keine Gerichte sicher gelesen werden. Bitte nutze weniger Seiten oder ein schärferes Foto.",
          quota,
        });
      return res.status(200).json({
        result,
        source: "OpenAI Responses API (Schnellanalyse)",
        quota,
      });
    }

    const prompt = [
      "Analysiere diese Zutatenliste für eine deutsche vegetarische/vegane Food-App.",
      "Antworte in allen Freitextfeldern auf Deutsch, unabhängig von der Sprache auf der Verpackung.",
      "Lies die sichtbaren Zutaten so vollständig wie möglich aus.",
      "Antworte ausschliesslich als valides JSON ohne Markdown.",
      "Pflichtschema: {classification:'vegan'|'vegetarian'|'not_suitable'|'unclear',confidence:'high'|'medium'|'low',productName?:string,brand?:string,detectedText?:string,summary:string,detectedIngredients:Array<{name:string,normalizedName?:string,status:'suitable'|'problematic'|'unclear',reason?:string}>,problematicIngredients:Array<{name:string,reason:string,sourceType?:'animal'|'possibly_animal'|'other'}>,possibleAllergens:string[],uncertainties:string[],suggestedAlternatives:Array<{name:string,reason:string}>}.",
      "Nenne Unsicherheiten ausdrücklich. Erfinde keine Produktdaten, Allergensicherheit oder Alternativen.",
    ].join("\n");
    const data = await requestOpenAI({
      maxOutputTokens: 1200,
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: images[0], detail: "auto" },
      ],
    });

    const text = extractResponseText(data);
    if (!text)
      return res.status(502).json({
        error:
          "OpenAI hat keine lesbare Analyse zurückgegeben. Bitte Bild erneut versuchen.",
      });
    return res.status(200).json({
      result: validateIngredientResult(safeJson(text)),
      source: "OpenAI Responses API",
      quota,
    });
  } catch (error) {
    const timedOut = ["AbortError", "TimeoutError"].includes(error?.name);
    return res.status(error?.status || (timedOut ? 504 : 500)).json({
      error: timedOut
        ? "Die Speisekartenanalyse hat das 60-Sekunden-Limit erreicht. Bitte nutze weniger Seiten oder ein schärferes Foto."
        : error instanceof Error
          ? error.message
          : "KI-Analyse nicht erreichbar.",
    });
  }
}

async function requestOpenAI({
  content,
  format,
  maxOutputTokens,
  timeoutMs = 48000,
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0,
      max_output_tokens: maxOutputTokens,
      ...(format ? { text: { format } } : {}),
      input: [{ role: "user", content }],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "OpenAI request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function validateExtractedMenu(value) {
  const seen = new Set();
  const dishes = Array.isArray(value?.dishes)
    ? value.dishes.slice(0, 100).flatMap((dish) => {
        if (!dish || typeof dish.name !== "string") return [];
        const name = dish.name.trim().slice(0, 160);
        const key = normalizeDishName(name);
        if (!key || seen.has(key)) return [];
        seen.add(key);
        return [
          {
            name,
            description:
              typeof dish.description === "string"
                ? dish.description.trim().slice(0, 500)
                : "",
          },
        ];
      })
    : [];
  return {
    language:
      typeof value?.language === "string"
        ? value.language.trim().slice(0, 20) || "de"
        : "de",
    dishes,
  };
}

export function reconcileMenuAssessment(extractedMenu, assessedMenu) {
  const assessedByName = new Map(
    assessedMenu.dishes.map((dish) => [normalizeDishName(dish.name), dish]),
  );
  const used = new Set();
  const dishes = extractedMenu.dishes.map((extractedDish, index) => {
    const exact = assessedByName.get(normalizeDishName(extractedDish.name));
    const positional = assessedMenu.dishes[index];
    const assessed = exact || (!used.has(positional) ? positional : undefined);
    if (assessed) used.add(assessed);
    return assessed
      ? { ...assessed, name: extractedDish.name }
      : {
          name: extractedDish.name,
          description: extractedDish.description,
          classification: "unclear",
          reason:
            "Das Gericht wurde gelesen, konnte aber nicht sicher bewertet werden.",
          problematicIngredients: [],
          adaptationSuggestion: "",
          questionForRestaurant: "",
          questionForRestaurantGerman: "",
          questionForRestaurantLocal: "",
          questionForRestaurantEnglish: "",
        };
  });
  return {
    language: extractedMenu.language,
    dishes,
    generalNotes: assessedMenu.generalNotes,
  };
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
  const rawDishes = Array.isArray(value?.dishes)
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
  const seenDishNames = new Set();
  const dishes = rawDishes.filter((dish) => {
    const key = normalizeDishName(dish.name);
    if (!key || seenDishNames.has(key)) return false;
    seenDishNames.add(key);
    return true;
  });
  return {
    ...(typeof value?.language === "string"
      ? { language: value.language.slice(0, 40) }
      : {}),
    dishes,
    generalNotes: cleanStrings(value?.generalNotes),
  };
}

function normalizeDishName(value) {
  return String(value)
    .toLocaleLowerCase("de")
    .replace(/^\s*\d+[.)-]?\s*/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
