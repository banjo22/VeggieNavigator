import { getSupabase } from "./supabase.js";

const TABLE = "community_spots";

export async function listCommunitySpots(userId = "", guestId = "") {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const items = (data || []).map(fromRow);
  if ((!clean(userId) && !clean(guestId)) || items.length === 0) return items;

  const table = clean(userId) ? "spot_confirmations" : "spot_guest_confirmations";
  const subjectColumn = clean(userId) ? "user_id" : "guest_id";
  const subjectId = clean(userId) || clean(guestId);

  const { data: confirmations, error: confirmationsError } = await getSupabase()
    .from(table)
    .select("spot_id")
    .eq(subjectColumn, subjectId)
    .in("spot_id", items.map((item) => item.id));

  if (confirmationsError) {
    if (!clean(userId) && isMissingRelationError(confirmationsError)) return items;
    throw confirmationsError;
  }
  const confirmedIds = new Set((confirmations || []).map((item) => Number(item.spot_id)));
  return items.map((item) => ({ ...item, viewerConfirmed: confirmedIds.has(item.id) }));
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

export async function confirmCommunitySpot(id, userId = "", guestId = "") {
  if (!Number(id)) throw new Error("Spot-ID fehlt.");
  if (!clean(userId) && !clean(guestId)) throw new Error("Bestaetigung nicht zuordenbar.");
  const supabase = getSupabase();
  const isUser = Boolean(clean(userId));
  const { data: insertedConfirmation, error: insertError } = await supabase
    .from(isUser ? "spot_confirmations" : "spot_guest_confirmations")
    .insert(isUser
      ? { spot_id: Number(id), user_id: clean(userId) }
      : { spot_id: Number(id), guest_id: clean(guestId) })
    .select("spot_id")
    .maybeSingle();

  if (insertError?.code === "23505") {
    const { data: currentSpot, error: currentError } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (currentError) throw currentError;
    return { ...fromRow(currentSpot), viewerConfirmed: true };
  }
  if (insertError) {
    if (!isUser && isMissingRelationError(insertError)) {
      throw new Error("Gast-Bestaetigungen sind noch nicht in Supabase eingerichtet. Fuehre supabase/guest-spot-confirmations.sql im SQL Editor aus.");
    }
    throw insertError;
  }
  if (!insertedConfirmation) throw new Error("Spot konnte nicht bestaetigt werden.");

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
  return { ...fromRow(data), viewerConfirmed: true };
}

function toRow(input) {
  return {
    name: clean(input.name),
    place: clean(input.place),
    price: formatEuroPrice(input.price),
    status: clean(input.status),
    category: clean(input.category),
    lat: Number(input.lat),
    lng: Number(input.lng),
    description: clean(input.description),
    image_data_url: clean(input.imageDataUrl) || null,
    created_by: clean(input.createdBy) || null,
    created_by_name: clean(input.createdByName) || null,
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
    confirmations: Number(row.confirmations || 0),
    lat: Number(row.lat),
    lng: Number(row.lng),
    description: row.description || "",
    imageDataUrl: row.image_data_url || "",
    createdBy: row.created_by || "",
    createdByName: row.created_by_name || ""
  };
}

function clean(value) {
  return String(value || "").trim();
}

function isMissingRelationError(error) {
  return error?.code === "PGRST205" || String(error?.message || "").includes("Could not find the table");
}

function formatEuroPrice(value) {
  const cleaned = clean(value).replace(/\s*(eur|euro|€)\s*$/i, "").trim();
  if (!cleaned) return "Preis offen";
  return `${cleaned} €`;
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
