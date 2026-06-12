export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });

  const barcode = String(req.query.barcode || "").trim();
  if (!barcode) return res.status(400).json({ error: "barcode missing" });

  try {
    const response = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(barcode)}&size=50`);
    if (!response.ok) return res.status(response.status).json({ error: "Open Prices request failed" });

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

    return res.status(200).json({ items });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Preisvergleich gerade nicht erreichbar." });
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
}
