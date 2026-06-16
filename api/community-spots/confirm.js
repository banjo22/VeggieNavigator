import { confirmCommunitySpot } from "../../lib/community-spots.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!body.id) return res.status(400).json({ error: "id missing" });
    if (!body.userId && !body.guestId) return res.status(400).json({ error: "Bestaetigung nicht zuordenbar." });
    const spot = await confirmCommunitySpot(body.id, body.userId, body.guestId);
    return res.status(200).json({ item: spot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spot konnte nicht bestaetigt werden.";
    return res.status(500).json({ error: message });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
}
