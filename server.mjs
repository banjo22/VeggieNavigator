import "dotenv/config";
import { createServer } from "node:http";
import {
  confirmCommunitySpot,
  createCommunitySpot,
  listCommunitySpots,
  reactToCommunitySpot,
} from "./lib/community-spots.js";
import { fetchProductByBarcode } from "./lib/open-food-facts.js";
import { searchPlaces } from "./lib/place-search.js";
import { consumeScanQuota } from "./lib/scan-limits.js";
import { getAuthenticatedUser } from "./lib/request-auth.js";
import analyzeIngredientsHandler from "./api/analyze-ingredients.js";
import mobileHealthHandler from "./api/mobile-health.js";

const PORT = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  const requestOrigin = String(req.headers.origin || "");
  if (requestOrigin) res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-ID, X-Veggie-Client",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (url.pathname === "/api/product") return await getProduct(req, res, url);
    if (url.pathname === "/api/places") return await getPlaces(req, res, url);
    if (url.pathname === "/api/community-spots")
      return await communitySpots(req, res);
    if (url.pathname === "/api/community-spots/confirm")
      return await confirmSpot(req, res);
    if (url.pathname === "/api/community-spots/reaction")
      return await reactSpot(req, res);
    if (url.pathname === "/api/analyze-ingredients")
      return await runVercelHandler(analyzeIngredientsHandler, req, res);
    if (url.pathname === "/api/mobile-health")
      return await runVercelHandler(mobileHealthHandler, req, res);
    if (url.pathname === "/api/scan-follow-up")
      return await scanFollowUp(req, res);
    return sendJson(res, 404, { error: "Mobile API route not found." });
  } catch (error) {
    return sendJson(res, 500, {
      error: getErrorMessage(error, "Server error"),
    });
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Veggie Navigator mobile API listening on port ${PORT}`);
});

async function getProduct(req, res, url) {
  if (req.method !== "GET")
    return sendJson(res, 405, { error: "GET required" });
  const barcode = url.searchParams.get("barcode")?.trim();
  if (!barcode) return sendJson(res, 400, { error: "barcode missing" });
  try {
    await getAuthenticatedUser(req, { required: true });
  } catch (error) {
    return sendJson(res, error.status || 401, {
      error: error.message || "Anmeldung erforderlich.",
    });
  }

  let quota;
  try {
    quota = await consumeScanQuota(req);
  } catch (error) {
    return sendJson(res, error.status || 500, {
      error: error.message || "Scan-Limit konnte nicht geprüft werden.",
      quota: error.quota,
    });
  }

  const product = await fetchProductByBarcode(barcode);
  return sendJson(res, 200, { product, quota });
}

async function communitySpots(req, res) {
  let user;
  try {
    user = await getAuthenticatedUser(req, { required: true });
  } catch (error) {
    return sendJson(res, error.status || 401, {
      error: error.message || "Anmeldung erforderlich.",
    });
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      items: await listCommunitySpots(user.id),
    });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const item = await createCommunitySpot({
      ...body,
      createdBy: user.id,
      createdByName:
        user.user_metadata?.profile_name ||
        user.email?.split("@")[0] ||
        "Veggie Nutzer",
    });
    return sendJson(res, 201, { item });
  }

  return sendJson(res, 405, { error: "GET or POST required" });
}

async function confirmSpot(req, res) {
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "POST required" });
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readBody(req);
  if (!body.id) return sendJson(res, 400, { error: "id missing" });
  return sendJson(res, 200, {
    item: await confirmCommunitySpot(body.id, user.id),
  });
}

async function reactSpot(req, res) {
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "POST required" });
  const user = await requireUser(req, res);
  if (!user) return;
  const body = await readBody(req);
  if (!body.id) return sendJson(res, 400, { error: "id missing" });
  return sendJson(res, 200, {
    item: await reactToCommunitySpot(body.id, body.reaction, user.id),
  });
}

async function requireUser(req, res) {
  try {
    return await getAuthenticatedUser(req, { required: true });
  } catch (error) {
    sendJson(res, error.status || 401, {
      error: error.message || "Anmeldung erforderlich.",
    });
    return null;
  }
}

async function getPlaces(_req, res, url) {
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return sendJson(res, 200, { items: [] });
  return sendJson(res, 200, await searchPlaces(q));
}

async function runVercelHandler(handler, req, res) {
  req.body = await readBody(req);
  res.status = (status) => {
    res.statusCode = status;
    return res;
  };
  res.json = (body) => {
    if (!res.headersSent)
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
    return res;
  };
  return handler(req, res);
}

async function scanFollowUp(req, res) {
  if (req.method !== "POST")
    return sendJson(res, 405, { error: "POST required" });
  try {
    await getAuthenticatedUser(req, { required: true });
  } catch (error) {
    return sendJson(res, error.status || 401, {
      error: error.message || "Anmeldung erforderlich.",
    });
  }
  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 501, { error: "OPENAI_API_KEY fehlt." });
  }

  const { question, context } = await readBody(req);
  const cleanQuestion = String(question || "").trim();
  if (cleanQuestion.length < 2)
    return sendJson(res, 400, { error: "Bitte stelle eine konkrete Frage." });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(40000),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      max_output_tokens: 420,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Du bist der Rückfragen-Assistent einer deutschen vegetarisch/veganen Food-App.",
                "Beantworte nur Fragen zum übergebenen Scan-Kontext. Erfinde keine Zutaten.",
                "Wenn die Antwort aus dem Kontext nicht sicher ableitbar ist, sage das klar und kurz.",
                "Antworte auf Deutsch, hilfreich, knapp und alltagstauglich.",
                "",
                `Scan-Kontext JSON: ${JSON.stringify(context || {}).slice(0, 6000)}`,
                "",
                `Frage: ${cleanQuestion}`,
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok)
    return sendJson(res, response.status, {
      error: data.error?.message || "OpenAI request failed",
    });
  return sendJson(res, 200, { answer: extractResponseText(data) });
}

function sendJson(res, status, body) {
  if (!res.headersSent)
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(status === 204 ? "" : JSON.stringify(body));
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error)
    return String(error.message);
  return fallback;
}

function readBody(req) {
  if (req.body !== undefined) return Promise.resolve(req.body);
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
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

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim())
    return data.output_text.trim();
  const chunks = [];
  const walk = (value) => {
    if (!value || typeof value === "string") return;
    if (Array.isArray(value)) return value.forEach(walk);
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
