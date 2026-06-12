import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (url.pathname === "/api/prices") return getPrices(req, res, url);
    if (url.pathname === "/api/places") return getPlaces(req, res, url);
    if (url.pathname === "/api/analyze-ingredients") return analyzeIngredients(req, res);
    return serveStatic(res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Server error" });
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

async function getPlaces(_req, res, url) {
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return sendJson(res, 200, { items: [] });

  if (process.env.GOOGLE_MAPS_API_KEY) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types"
      },
      body: JSON.stringify({ textQuery: q, pageSize: 8, regionCode: "DE" })
    });
    if (!response.ok) return sendJson(res, response.status, { error: "Google Places request failed" });
    const data = await response.json();
    return sendJson(res, 200, {
      provider: "Google Places",
      items: (data.places || []).map((place) => ({
        id: place.id,
        name: place.displayName?.text || "Unbenannter Ort",
        address: place.formattedAddress || "",
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        types: place.types || [],
        provider: "Google Places"
      }))
    });
  }

  const params = new URLSearchParams({
    q: `${q} Germany`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8"
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "VeggieNavigatorMVP/0.1",
      "Accept-Language": "de"
    }
  });
  if (!response.ok) return getPhotonPlaces(res, q);
  const data = await response.json();
  return sendJson(res, 200, {
    provider: "OpenStreetMap Nominatim",
    items: data.map((place) => ({
      id: `${place.osm_type}-${place.osm_id}`,
      name: place.name || place.display_name?.split(",")[0] || "Unbenannter Ort",
      address: place.display_name,
      lat: Number(place.lat),
      lng: Number(place.lon),
      types: [place.category, place.type].filter(Boolean),
      provider: "OpenStreetMap Nominatim"
    }))
  });
}

async function getPhotonPlaces(res, q) {
  const params = new URLSearchParams({
    q: `${q} Germany`,
    limit: "8",
    lang: "de"
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { "User-Agent": "VeggieNavigatorMVP/0.1" }
  });
  if (!response.ok) return sendJson(res, response.status, { error: "Standortsuche gerade nicht erreichbar." });
  const data = await response.json();
  return sendJson(res, 200, {
    provider: "Photon / OpenStreetMap",
    items: (data.features || []).map((feature) => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [];
      const parts = [props.street, props.housenumber, props.postcode, props.city, props.country].filter(Boolean);
      return {
        id: props.osm_id ? `${props.osm_type || "osm"}-${props.osm_id}` : `${props.name}-${coords.join(",")}`,
        name: props.name || props.street || "Unbenannter Ort",
        address: parts.join(", "),
        lat: coords[1],
        lng: coords[0],
        types: [props.osm_key, props.osm_value].filter(Boolean),
        provider: "Photon / OpenStreetMap"
      };
    }).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
  });
}

async function analyzeIngredients(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST required" });
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 501, { error: "OPENAI_API_KEY fehlt. Lege ihn in der Umgebung an und starte den API-Server neu." });
  }

  const { imageDataUrl, mode = "ingredients" } = await readBody(req);
  if (!imageDataUrl) return sendJson(res, 400, { error: "imageDataUrl missing" });
  const isMenu = mode === "menu";
  const prompt = isMenu
    ? [
        "Analysiere ausschliesslich die sichtbare Speisekarte im Bild. Erfinde keine Gerichte.",
        "Wenn ein Gericht nicht lesbar ist, lass es weg.",
        "Wenn vor einem Gericht eine Nummer steht, uebernimm die Nummer zur Orientierung, z.B. '12 Pasta Arrabbiata'.",
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
          {
            type: "input_text",
            text: prompt
          },
          { type: "input_image", image_url: imageDataUrl }
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) return sendJson(res, response.status, { error: data.error?.message || "OpenAI request failed" });
  const text = extractResponseText(data);
  if (!text) return sendJson(res, 502, { error: "OpenAI hat keine lesbare Analyse zurueckgegeben. Bitte Bild erneut versuchen." });
  if (isMenu) return sendJson(res, 200, { result: { text }, raw: text, source: "OpenAI Responses API" });
  return sendJson(res, 200, { result: safeJson(text), raw: text, source: "OpenAI Responses API" });
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
      confidence: 0
    };
  }
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
