export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });

  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) return res.status(200).json({ items: [] });

  try {
    if (process.env.GOOGLE_MAPS_API_KEY) return getGooglePlaces(res, q);
    return getNominatimPlaces(res, q);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Standortsuche gerade nicht erreichbar." });
  }
}

async function getGooglePlaces(res, q) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types"
    },
    body: JSON.stringify({ textQuery: q, pageSize: 8, regionCode: "DE" })
  });
  if (!response.ok) return res.status(response.status).json({ error: "Google Places request failed" });
  const data = await response.json();
  return res.status(200).json({
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

async function getNominatimPlaces(res, q) {
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
  return res.status(200).json({
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
  if (!response.ok) return res.status(response.status).json({ error: "Standortsuche gerade nicht erreichbar." });
  const data = await response.json();
  return res.status(200).json({
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

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
}
