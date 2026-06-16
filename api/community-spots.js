import { createCommunitySpot, listCommunitySpots } from "../lib/community-spots.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const userId = String(req.query.userId || "").trim();
      const guestId = String(req.query.guestId || "").trim();
      const items = await listCommunitySpots(userId, guestId);
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const spot = await createCommunitySpot(body);
      return res.status(201).json({ item: spot });
    }

    return res.status(405).json({ error: "GET or POST required" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Community-Spots nicht erreichbar.";
    return res.status(500).json({ error: message });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}
