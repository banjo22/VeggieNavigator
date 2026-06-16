const FOOD_TYPES = new Set(["restaurant", "fast_food", "cafe", "food_court", "bar", "pub", "supermarket", "convenience", "bakery"]);
const BAD_TYPES = new Set(["construction", "parking", "service", "road", "residential"]);

export async function searchPlaces(query) {
  const q = clean(query);
  if (q.length < 2) return { provider: "Places", items: [] };

  const googleItems = process.env.GOOGLE_MAPS_API_KEY ? await getGooglePlaces(q).catch(() => []) : [];
  const freeResults = await Promise.allSettled([
    getNominatimPlaces(q),
    getPhotonPlaces(q)
  ]);
  const freeItems = freeResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const items = rankPlaces(dedupePlaces([...googleItems, ...freeItems]), q).slice(0, 10);

  return {
    provider: googleItems.length > 0 ? "Google Places + OpenStreetMap" : "OpenStreetMap + Photon",
    items
  };
}

async function getGooglePlaces(q) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types"
    },
    body: JSON.stringify({ textQuery: q, pageSize: 10, regionCode: "DE" })
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.places || []).map((place) => normalizePlace({
    id: place.id,
    name: place.displayName?.text || "Unbenannter Ort",
    address: place.formattedAddress || "",
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    types: place.types || [],
    provider: "Google Places"
  }));
}

async function getNominatimPlaces(q) {
  const searches = unique([q, `${q} Deutschland`, normalizeBrandQuery(q)]);
  const results = await Promise.allSettled(searches.map(async (search) => {
    const params = new URLSearchParams({
      q: search,
      format: "jsonv2",
      addressdetails: "1",
      namedetails: "1",
      limit: "10",
      countrycodes: "de"
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "VeggieNavigatorMVP/0.1",
        "Accept-Language": "de"
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((place) => normalizePlace({
      id: `${place.osm_type}-${place.osm_id}`,
      name: place.name || place.display_name?.split(",")[0] || "Unbenannter Ort",
      address: place.display_name || "",
      lat: Number(place.lat),
      lng: Number(place.lon),
      types: [place.category, place.type, place.addresstype].filter(Boolean),
      provider: "OpenStreetMap Nominatim"
    }));
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

async function getPhotonPlaces(q) {
  const searches = unique([q, `${q} Deutschland`, normalizeBrandQuery(q)]);
  const results = await Promise.allSettled(searches.map(async (search) => {
    const params = new URLSearchParams({
      q: search,
      limit: "10",
      lang: "de"
    });
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
      headers: { "User-Agent": "VeggieNavigatorMVP/0.1" }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.features || []).map((feature) => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [];
      const parts = [
        joinStreet(props.street, props.housenumber),
        props.postcode,
        props.city || props.district || props.county,
        props.country
      ].filter(Boolean);
      return normalizePlace({
        id: props.osm_id ? `${props.osm_type || "osm"}-${props.osm_id}` : `${props.name || props.street}-${coords.join(",")}`,
        name: props.name || props.street || "Unbenannter Ort",
        address: parts.join(", "),
        lat: coords[1],
        lng: coords[0],
        types: [props.osm_key, props.osm_value, props.type].filter(Boolean),
        provider: "Photon / OpenStreetMap"
      });
    });
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

function normalizePlace(place) {
  return {
    ...place,
    lat: Number(place.lat),
    lng: Number(place.lng),
    types: (place.types || []).map((type) => clean(type).toLowerCase()).filter(Boolean)
  };
}

function rankPlaces(items, q) {
  const tokens = normalizeText(q).split(" ").filter((token) => token.length > 1);
  return items
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map((item) => ({ ...item, score: getPlaceScore(item, tokens) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "de"))
    .map(({ score: _score, ...item }) => item);
}

function getPlaceScore(item, tokens) {
  const name = normalizeText(item.name);
  const address = normalizeText(item.address);
  let score = 0;
  if (tokens.length > 0 && tokens.every((token) => name.includes(token) || address.includes(token))) score += 45;
  if (tokens.some((token) => name.includes(token))) score += 25;
  if (item.types.some((type) => FOOD_TYPES.has(type))) score += 35;
  if (item.types.some((type) => BAD_TYPES.has(type))) score -= 30;
  if (item.address) score += 8;
  if (address.includes("deutschland")) score += 4;
  return score;
}

function dedupePlaces(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
    const key = `${normalizeText(item.name)}:${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeBrandQuery(q) {
  return q
    .replace(/\bmcdonalds\b/ig, "McDonald's")
    .replace(/\bburgerking\b/ig, "Burger King")
    .replace(/\bkfc\b/ig, "KFC")
    .replace(/\bsubway\b/ig, "Subway");
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function joinStreet(street, housenumber) {
  return [street, housenumber].filter(Boolean).join(" ");
}

function unique(values) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function clean(value) {
  return String(value || "").trim();
}
