import { createCommunitySpot, listCommunitySpots } from "../lib/community-spots.js";
import { getAuthenticatedUser } from "../lib/request-auth.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const user = await getAuthenticatedUser(req, { required: true });
      const items = await listCommunitySpots(user.id);
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const user = await getAuthenticatedUser(req, { required: true });
      const spot = await createCommunitySpot({ ...body, createdBy: user.id, createdByName: user.user_metadata?.profile_name || user.email?.split("@")[0] || "Veggie Nutzer" });
      return res.status(201).json({ item: spot });
    }
    return res.status(405).json({ error: "GET or POST required" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Community-Spots nicht erreichbar.";
    return res.status(error?.status || 500).json({ error: message });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Veggie-Client, X-Request-ID");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}
