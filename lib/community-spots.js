import { getSupabase } from "./supabase.js";

const TABLE = "community_spots";

export async function listCommunitySpots() {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createCommunitySpot(input) {
  const row = toRow(input);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function confirmCommunitySpot(id) {
  const supabase = getSupabase();
  const { data: current, error: readError } = await supabase
    .from(TABLE)
    .select("confirmations")
    .eq("id", id)
    .single();

  if (readError) throw readError;

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      confirmations: Number(current.confirmations || 0) + 1,
      confirmed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return fromRow(data);
}

function toRow(input) {
  return {
    name: clean(input.name),
    place: clean(input.place),
    price: clean(input.price) || "Preis offen",
    status: clean(input.status),
    category: clean(input.category),
    rating: clean(input.rating) || "neu",
    lat: Number(input.lat),
    lng: Number(input.lng),
    description: clean(input.description),
    image_data_url: clean(input.imageDataUrl) || null,
    confirmations: Number(input.confirmations || 0),
    confirmed_at: new Date().toISOString()
  };
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    place: row.place,
    price: row.price || "Preis offen",
    status: row.status,
    category: row.category,
    confirmed: row.confirmed_at ? relativeTime(row.confirmed_at) : "gerade eben",
    rating: row.rating || "neu",
    confirmations: Number(row.confirmations || 0),
    lat: Number(row.lat),
    lng: Number(row.lng),
    description: row.description || "",
    imageDataUrl: row.image_data_url || ""
  };
}

function clean(value) {
  return String(value || "").trim();
}

function relativeTime(value) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 2) return "gerade eben";
  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString("de-DE");
}
