import { fetchProductByBarcode } from "../lib/open-food-facts.js";
import { consumeScanQuota } from "../lib/scan-limits.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });

  const barcode = String(req.query.barcode || "").trim();
  if (!barcode) return res.status(400).json({ error: "barcode missing" });

  try {
    const quota = await consumeScanQuota(req);
    const product = await fetchProductByBarcode(barcode);
    return res.status(200).json({ product, quota });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Produktdaten nicht erreichbar.",
      quota: error.quota
    });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
}
