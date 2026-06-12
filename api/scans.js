import { createScan, listScans } from "../lib/user-activity.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const userId = String(req.query.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "userId missing" });
      return res.status(200).json({ items: await listScans(userId) });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      return res.status(201).json({ item: await createScan(body) });
    }

    return res.status(405).json({ error: "GET or POST required" });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Scans nicht erreichbar." });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

