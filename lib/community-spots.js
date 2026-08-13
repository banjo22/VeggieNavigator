import { getSupabase } from "./supabase.js";

const TABLE = "community_spots";

export async function listCommunitySpots(userId) {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  const items = await addReactionData((data || []).map(fromRow), userId);
  if (!clean(userId) || items.length === 0) return items;

  const { data: confirmations, error: confirmationsError } = await getSupabase()
    .from("spot_confirmations")
    .select("spot_id")
    .eq("user_id", clean(userId))
    .in("spot_id", items.map((item) => item.id));

  if (confirmationsError) throw confirmationsError;
  const confirmedIds = new Set((confirmations || []).map((item) => Number(item.spot_id)));
  return items.map((item) => ({ ...item, viewerConfirmed: confirmedIds.has(item.id) }));
}

export async function createCommunitySpot(input) {
  const row = normalizeCommunitySpotInput(input);
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function confirmCommunitySpot(id, userId) {
  if (!Number(id)) throw new Error("Spot-ID fehlt.");
  if (!clean(userId)) throw new Error("Bestätigung nicht zuordenbar.");
  const supabase = getSupabase();
  const { data: insertedConfirmation, error: insertError } = await supabase
    .from("spot_confirmations")
    .insert({ spot_id: Number(id), user_id: clean(userId) })
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
  if (insertError) throw insertError;
  if (!insertedConfirmation) throw new Error("Spot konnte nicht bestätigt werden.");

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

export async function reactToCommunitySpot(id, reaction, userId) {
  if (!Number(id)) throw new Error("Spot-ID fehlt.");
  if (!clean(userId)) throw new Error("Reaktion nicht zuordenbar.");
  const normalizedReaction = clean(reaction);
  if (normalizedReaction && !["like", "dislike"].includes(normalizedReaction)) throw new Error("Ungültige Reaktion.");

  const supabase = getSupabase();
  const subjectId = clean(userId);

  const { data: currentReaction, error: currentError } = await supabase
    .from("spot_reactions")
    .select("id,reaction")
    .eq("spot_id", Number(id))
    .eq("user_id", subjectId)
    .maybeSingle();

  if (currentError) {
    if (isMissingRelationError(currentError)) throw new Error("Spot-Reaktionen sind noch nicht in Supabase eingerichtet. Führe supabase/spot-reactions.sql im SQL Editor aus.");
    throw currentError;
  }

  if (!normalizedReaction || currentReaction?.reaction === normalizedReaction) {
    if (currentReaction?.id) {
      const { error } = await supabase.from("spot_reactions").delete().eq("id", currentReaction.id);
      if (error) throw error;
    }
  } else if (currentReaction?.id) {
    const { error } = await supabase
      .from("spot_reactions")
      .update({ reaction: normalizedReaction, updated_at: new Date().toISOString() })
      .eq("id", currentReaction.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("spot_reactions")
      .insert({ spot_id: Number(id), user_id: subjectId, reaction: normalizedReaction });
    if (error) {
      if (isMissingRelationError(error)) throw new Error("Spot-Reaktionen sind noch nicht in Supabase eingerichtet. Führe supabase/spot-reactions.sql im SQL Editor aus.");
      throw error;
    }
  }

  const { data: spot, error: spotError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", Number(id))
    .single();
  if (spotError) throw spotError;
  const [item] = await addReactionData([fromRow(spot)], userId);
  return item;
}

async function addReactionData(items, userId = "") {
  if (items.length === 0) return items;
  const spotIds = items.map((item) => item.id);
  const { data: reactions, error } = await getSupabase()
    .from("spot_reactions")
    .select("spot_id,reaction,user_id")
    .in("spot_id", spotIds);

  if (error) {
    if (isMissingRelationError(error)) return items.map((item) => ({ ...item, likeCount: 0, dislikeCount: 0, viewerReaction: "" }));
    throw error;
  }

  const counts = new Map();
  const viewerUserId = clean(userId);
  const viewerReactions = new Map();

  (reactions || []).forEach((item) => {
    const spotId = Number(item.spot_id);
    const current = counts.get(spotId) || { like: 0, dislike: 0 };
    if (item.reaction === "like") current.like += 1;
    if (item.reaction === "dislike") current.dislike += 1;
    counts.set(spotId, current);
    if (viewerUserId && item.user_id === viewerUserId) {
      viewerReactions.set(spotId, item.reaction);
    }
  });

  return items.map((item) => {
    const count = counts.get(item.id) || { like: 0, dislike: 0 };
    return {
      ...item,
      likeCount: count.like,
      dislikeCount: count.dislike,
      viewerReaction: viewerReactions.get(item.id) || ""
    };
  });
}

export function normalizeCommunitySpotInput(input) {
  const name = clean(input.name);
  const place = clean(input.place);
  const status = clean(input.status);
  const category = clean(input.category);
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (name.length < 2 || name.length > 120) throw new Error("Der Spot-Name muss 2 bis 120 Zeichen lang sein.");
  if (place.length < 3 || place.length > 240) throw new Error("Bitte gib einen gültigen Standort an.");
  if (!["vegan", "vegetarisch", "nicht veggie", "vegan moeglich"].includes(status)) throw new Error("Ungültiger Spot-Status.");
  if (!category || category.length > 80) throw new Error("Ungültige Kategorie.");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("Ungültige Koordinaten.");
  return {
    name,
    place,
    price: formatEuroPrice(input.price),
    status,
    category,
    lat,
    lng,
    description: clean(input.description).slice(0, 1200),
    image_url: clean(input.imageUrl) || null,
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
    likeCount: Number(row.like_count || 0),
    dislikeCount: Number(row.dislike_count || 0),
    viewerReaction: row.viewer_reaction || "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    description: row.description || "",
    imageDataUrl: row.image_url || "",
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
