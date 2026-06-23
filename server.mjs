import "dotenv/config";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { claimCommunitySpots, confirmCommunitySpot, createCommunitySpot, listCommunitySpots, reactToCommunitySpot } from "./lib/community-spots.js";
import { fetchProductByBarcode } from "./lib/open-food-facts.js";
import { searchPlaces } from "./lib/place-search.js";
import { consumeScanQuota, getScanQuotaStatus } from "./lib/scan-limits.js";
import { createComment, createScan, deleteAllScans, deleteComment, deleteProductFavorite, deleteScan, getProfile, listComments, listProductFavorites, listScans, upsertProductFavorite, upsertProfile } from "./lib/user-activity.js";

const PORT = Number(process.env.PORT || 8787);
const ROOT = resolve(".");
const DIST = join(ROOT, "dist");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (url.pathname === "/api/prices") return await getPrices(req, res, url);
    if (url.pathname === "/api/product") return await getProduct(req, res, url);
    if (url.pathname === "/api/scan-quota") return await getScanQuota(req, res);
    if (url.pathname === "/api/places") return await getPlaces(req, res, url);
    if (url.pathname === "/api/community-spots") return await communitySpots(req, res);
    if (url.pathname === "/api/community-spots/confirm") return await confirmSpot(req, res);
    if (url.pathname === "/api/community-spots/reaction") return await reactSpot(req, res);
    if (url.pathname === "/api/profile") return await profile(req, res, url);
    if (url.pathname === "/api/product-favorites") return await productFavorites(req, res, url);
    if (url.pathname === "/api/scans") return await scans(req, res, url);
    if (url.pathname === "/api/comments") return await comments(req, res, url);
    if (url.pathname === "/api/analyze-ingredients") return await analyzeIngredients(req, res);
    return await serveStatic(res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: getErrorMessage(error, "Server error") });
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Veggie Navigator listening on port ${PORT}`);
});

async function getPrices(_req, res, url) {
  const barcode = url.searchParams.get("barcode")?.trim();
  if (!barcode) return sendJson(res, 400, { error: "barcode missing" });

  const response = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(barcode)}&size=50`);
  if (!response.ok) return sendJson(res, response.status, { error: "Open Prices request failed" });

  const data = await response.json();
  const items = (data.items || [])
    .filter((item) => item.product_code === barcode && item.price && item.currency)
    .map((item) => ({
      store: item.location?.osm_brand || item.location?.osm_name || "Unbekannter Laden",
      address: item.location?.osm_display_name || "",
      city: item.location?.osm_address_city || "",
      country: item.location?.osm_address_country_code || "",
      price: Number(item.price),
      currency: item.currency,
      date: item.date,
      discounted: Boolean(item.price_is_discounted),
      lat: item.location?.osm_lat,
      lng: item.location?.osm_lon,
      source: "Open Food Facts Open Prices"
    }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 6);

  return sendJson(res, 200, { items });
}

async function getProduct(req, res, url) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "GET required" });
  const barcode = url.searchParams.get("barcode")?.trim();
  if (!barcode) return sendJson(res, 400, { error: "barcode missing" });

  let quota;
  try {
    quota = await consumeScanQuota(req);
  } catch (error) {
    return sendJson(res, error.status || 500, {
      error: error.message || "Scan-Limit konnte nicht geprüft werden.",
      quota: error.quota
    });
  }

  const product = await fetchProductByBarcode(barcode);
  return sendJson(res, 200, { product, quota });
}

async function getScanQuota(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "GET required" });
  try {
    return sendJson(res, 200, { quota: await getScanQuotaStatus(req) });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      error: error.message || "Scan-Limit konnte nicht geladen werden.",
      quota: error.quota
    });
  }
}

async function communitySpots(req, res) {
  if (req.method === "GET") {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId")?.trim() || "";
    const guestId = url.searchParams.get("guestId")?.trim() || "";
    const items = await listCommunitySpots(userId, guestId);
    return sendJson(res, 200, { items });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const item = await createCommunitySpot(body);
    return sendJson(res, 201, { item });
  }

  if (req.method === "PATCH") {
    const body = await readBody(req);
    const items = await claimCommunitySpots(body);
    return sendJson(res, 200, { items });
  }

  return sendJson(res, 405, { error: "GET, POST or PATCH required" });
}

async function confirmSpot(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST required" });
  const body = await readBody(req);
  if (!body.id) return sendJson(res, 400, { error: "id missing" });
  if (!body.userId && !body.guestId) return sendJson(res, 400, { error: "Bestätigung nicht zuordenbar." });
  const item = await confirmCommunitySpot(body.id, body.userId, body.guestId);
  return sendJson(res, 200, { item });
}

async function reactSpot(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST required" });
  const body = await readBody(req);
  if (!body.id) return sendJson(res, 400, { error: "id missing" });
  if (!body.userId && !body.guestId) return sendJson(res, 400, { error: "Reaktion nicht zuordenbar." });
  const item = await reactToCommunitySpot(body.id, body.reaction, body.userId, body.guestId);
  return sendJson(res, 200, { item });
}

async function profile(req, res, url) {
  if (req.method === "GET") {
    const userId = url.searchParams.get("userId")?.trim();
    if (!userId) return sendJson(res, 400, { error: "userId missing" });
    return sendJson(res, 200, { profile: await getProfile(userId) });
  }
  if (req.method === "POST") return sendJson(res, 200, { profile: await upsertProfile(await readBody(req)) });
  return sendJson(res, 405, { error: "GET or POST required" });
}

async function productFavorites(req, res, url) {
  if (req.method === "GET") {
    const userId = url.searchParams.get("userId")?.trim();
    if (!userId) return sendJson(res, 400, { error: "userId missing" });
    return sendJson(res, 200, { items: await listProductFavorites(userId) });
  }
  if (req.method === "POST") return sendJson(res, 201, { item: await upsertProductFavorite(await readBody(req)) });
  if (req.method === "DELETE") {
    const userId = url.searchParams.get("userId")?.trim();
    const barcode = url.searchParams.get("barcode")?.trim();
    if (!userId) return sendJson(res, 400, { error: "userId missing" });
    if (!barcode) return sendJson(res, 400, { error: "barcode missing" });
    return sendJson(res, 200, await deleteProductFavorite({ userId, barcode }));
  }
  return sendJson(res, 405, { error: "GET, POST or DELETE required" });
}

async function scans(req, res, url) {
  if (req.method === "GET") {
    const userId = url.searchParams.get("userId")?.trim();
    if (!userId) return sendJson(res, 400, { error: "userId missing" });
    return sendJson(res, 200, { items: await listScans(userId) });
  }
  if (req.method === "POST") return sendJson(res, 201, { item: await createScan(await readBody(req)) });
  if (req.method === "DELETE") {
    const userId = url.searchParams.get("userId")?.trim();
    if (!userId) return sendJson(res, 400, { error: "userId missing" });
    if (url.searchParams.get("all") === "true") return sendJson(res, 200, await deleteAllScans(userId));
    const scanId = url.searchParams.get("scanId")?.trim();
    if (!scanId) return sendJson(res, 400, { error: "scanId missing" });
    return sendJson(res, 200, await deleteScan({ userId, scanId }));
  }
  return sendJson(res, 405, { error: "GET, POST or DELETE required" });
}

async function comments(req, res, url) {
  if (req.method === "GET") {
    const spotId = url.searchParams.get("spotId")?.trim();
    if (!spotId) return sendJson(res, 400, { error: "spotId missing" });
    return sendJson(res, 200, { items: await listComments(spotId) });
  }
  if (req.method === "POST") return sendJson(res, 201, { item: await createComment(await readBody(req)) });
  if (req.method === "DELETE") {
    const userId = url.searchParams.get("userId")?.trim();
    const commentId = url.searchParams.get("commentId")?.trim();
    if (!userId) return sendJson(res, 400, { error: "userId missing" });
    if (!commentId) return sendJson(res, 400, { error: "commentId missing" });
    return sendJson(res, 200, await deleteComment({ userId, commentId }));
  }
  return sendJson(res, 405, { error: "GET, POST or DELETE required" });
}

async function getPlaces(_req, res, url) {
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return sendJson(res, 200, { items: [] });
  return sendJson(res, 200, await searchPlaces(q));
}

async function analyzeIngredients(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST required" });
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 501, { error: "OPENAI_API_KEY fehlt. Lege ihn in der Umgebung an und starte den API-Server neu." });
  }

  const { imageDataUrl, imageDataUrls, mode = "ingredients" } = await readBody(req);
  const isMenu = mode === "menu";
  const images = isMenu ? normalizeImages(imageDataUrls || imageDataUrl) : normalizeImages(imageDataUrl).slice(0, 1);
  if (images.length === 0) return sendJson(res, 400, { error: "Bitte lade mindestens ein Bild hoch oder fotografiere eine Seite." });
  let quota;
  try {
    quota = await consumeScanQuota(req);
  } catch (error) {
    return sendJson(res, error.status || 500, {
      error: error.message || "Scan-Limit konnte nicht geprüft werden.",
      quota: error.quota
    });
  }
  const prompt = isMenu
    ? [
        "Analysiere ausschliesslich die sichtbare Speisekarte in allen Bildern. Die Bilder können mehrere Seiten derselben Speisekarte sein.",
        "Fasse die Seiten zusammen und vermeide doppelte Gerichte.",
        "Erfinde keine Gerichte.",
        "Wenn ein Gericht nicht lesbar ist, lass es weg.",
        "Wenn vor einem Gericht eine Nummer steht, übernimm die Nummer zur Orientierung, z.B. '12 Pasta Arrabbiata'.",
        "Gib nur kurzen deutschen Plain-Text aus, keine JSON, kein {}, keine Einleitung.",
        "Format:",
        "Vegan:",
        "- Gericht",
        "Vegetarisch:",
        "- Gericht",
        "Anpassbar:",
        "- Gericht -> Änderung, damit vegan/vegetarisch",
        "Wenn eine Kategorie leer ist: '- nichts gefunden'."
      ].join("\n")
    : [
        "Analysiere diese Zutatenliste für eine junge deutsche vegetarische/vegane Food-App.",
        "Lies die sichtbaren Zutaten so vollständig wie möglich aus.",
        "Antworte ausschliesslich als valides JSON ohne Markdown.",
        "Pflichtfelder:",
        "status: vegan|vegetarisch|nicht veggie|unklar",
        "explanation: kurze deutsche Erklärung",
        "problematicIngredients: Array der Zutaten, die für vegan/vegetarisch kritisch sind",
        "detectedIngredients: Array aller gut lesbaren sichtbaren Zutaten, auch wenn sie nicht kritisch sind, z.B. Weizenmehl, Haferflocken, Gerstenmalzextrakt",
        "confidence: Zahl 0-1"
      ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(85000),
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      max_output_tokens: isMenu ? 650 : 550,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt
          },
          ...images.map((image) => ({ type: "input_image", image_url: image }))
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) return sendJson(res, response.status, { error: data.error?.message || "OpenAI request failed" });
  const text = extractResponseText(data);
  if (!text) return sendJson(res, 502, { error: "OpenAI hat keine lesbare Analyse zurückgegeben. Bitte Bild erneut versuchen." });
  if (isMenu) return sendJson(res, 200, { result: { text }, raw: text, source: "OpenAI Responses API", quota });
  return sendJson(res, 200, { result: safeJson(text), raw: text, source: "OpenAI Responses API", quota });
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = join(DIST, safePath);
  const target = existsSync(filePath) ? filePath : join(DIST, "index.html");
  const body = await readFile(target);
  res.writeHead(200, { "Content-Type": mime[extname(target)] || "application/octet-stream" });
  res.end(body);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(status === 204 ? "" : JSON.stringify(body));
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return fallback;
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
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
      detectedIngredients: [],
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
