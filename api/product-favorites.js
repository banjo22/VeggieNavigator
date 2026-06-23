import { deleteProductFavorite, listProductFavorites, upsertProductFavorite } from "../lib/user-activity.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const userId = String(req.query.userId || "").trim();
      if (!userId) return res.status(400).json({ error: "userId missing" });
      return res.status(200).json({ items: await listProductFavorites(userId) });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      return res.status(201).json({ item: await upsertProductFavorite(body) });
    }

    if (req.method === "DELETE") {
      const userId = String(req.query.userId || "").trim();
      const barcode = String(req.query.barcode || "").trim();
      if (!userId) return res.status(400).json({ error: "userId missing" });
      if (!barcode) return res.status(400).json({ error: "barcode missing" });
      return res.status(200).json(await deleteProductFavorite({ userId, barcode }));
    }

    return res.status(405).json({ error: "GET, POST or DELETE required" });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Gemerkte Produkte nicht erreichbar." });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
}
