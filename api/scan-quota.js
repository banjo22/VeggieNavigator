import { getScanQuotaStatus } from "../lib/scan-limits.js";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });

  try {
    return res.status(200).json({ quota: await getScanQuotaStatus(req) });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Scan-Limit konnte nicht geladen werden.",
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
