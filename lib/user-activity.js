import { getSupabase } from "./supabase.js";

export async function getProfile(userId) {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data ? fromProfileRow(data) : null;
}

export async function upsertProfile(input) {
  if (!clean(input.id)) throw new Error("Profil-ID fehlt.");
  const row = {
    id: clean(input.id),
    profile_name: clean(input.profileName) || "Veggie Nutzer",
    public_spots: Boolean(input.publicSpots),
    public_scans: Boolean(input.publicScans),
    public_comments: input.publicComments !== false,
    updated_at: new Date().toISOString()
  };
  if ("avatarUrl" in input) row.avatar_url = clean(input.avatarUrl) || null;
  if ("dietMode" in input) row.diet_mode = clean(input.dietMode) || "vegan";
  if ("warningIngredients" in input) row.warning_ingredients = Array.isArray(input.warningIngredients) ? input.warningIngredients.map(clean).filter(Boolean) : [];

  const { data, error } = await getSupabase()
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return fromProfileRow(data);
}

export async function listScans(userId) {
  if (!clean(userId)) throw new Error("User-ID fehlt.");
  const { data, error } = await getSupabase()
    .from("scan_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []).map(fromScanRow);
}

export async function listProductFavorites(userId) {
  if (!clean(userId)) throw new Error("User-ID fehlt.");
  const { data, error } = await getSupabase()
    .from("product_favorites")
    .select("*")
    .eq("user_id", clean(userId))
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []).map(fromFavoriteRow);
}

export async function upsertProductFavorite(input) {
  if (!clean(input.userId)) throw new Error("User-ID fehlt.");
  if (!clean(input.barcode)) throw new Error("Produkt-ID fehlt.");
  const { data, error } = await getSupabase()
    .from("product_favorites")
    .upsert({
      user_id: clean(input.userId),
      barcode: clean(input.barcode),
      name: clean(input.name) || "Produkt",
      status: clean(input.status) || "unklar",
      image_url: clean(input.imageUrl) || null,
      reason: clean(input.reason) || null,
      created_at: input.createdAt || new Date().toISOString()
    }, { onConflict: "user_id,barcode" })
    .select("*")
    .single();

  if (error) throw error;
  return fromFavoriteRow(data);
}

export async function deleteProductFavorite(input) {
  if (!clean(input.userId)) throw new Error("User-ID fehlt.");
  if (!clean(input.barcode)) throw new Error("Produkt-ID fehlt.");
  const { error } = await getSupabase()
    .from("product_favorites")
    .delete()
    .eq("user_id", clean(input.userId))
    .eq("barcode", clean(input.barcode));

  if (error) throw error;
  return { deleted: true };
}

export async function createScan(input) {
  if (!clean(input.userId)) throw new Error("User-ID fehlt.");
  if (!clean(input.type)) throw new Error("Scan-Typ fehlt.");
  if (!clean(input.title)) throw new Error("Scan-Titel fehlt.");
  const { data, error } = await getSupabase()
    .from("scan_history")
    .insert({
      user_id: clean(input.userId),
      scan_type: clean(input.type),
      title: clean(input.title),
      subtitle: clean(input.subtitle),
      payload: input.payload || {},
      is_public: Boolean(input.isPublic)
    })
    .select("*")
    .single();

  if (error) throw error;
  return fromScanRow(data);
}

export async function deleteScan(input) {
  const userId = clean(input.userId);
  const scanId = Number(input.scanId);
  if (!userId) throw new Error("User-ID fehlt.");
  if (!scanId) throw new Error("Scan-ID fehlt.");

  const { error } = await getSupabase()
    .from("scan_history")
    .delete()
    .eq("user_id", userId)
    .eq("id", scanId);

  if (error) throw error;
  return { deleted: true };
}

export async function deleteAllScans(userId) {
  const cleanUserId = clean(userId);
  if (!cleanUserId) throw new Error("User-ID fehlt.");

  const { error } = await getSupabase()
    .from("scan_history")
    .delete()
    .eq("user_id", cleanUserId);

  if (error) throw error;
  return { deleted: true };
}

export async function listComments(spotId) {
  if (!Number(spotId)) throw new Error("Spot-ID fehlt.");
  const { data, error } = await getSupabase()
    .from("spot_comments")
    .select("*")
    .eq("spot_id", spotId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw error;
  return (data || []).map(fromCommentRow);
}

export async function createComment(input) {
  if (!Number(input.spotId)) throw new Error("Spot-ID fehlt.");
  if (!clean(input.userId)) throw new Error("User-ID fehlt.");
  if (!clean(input.body)) throw new Error("Kommentar fehlt.");
  const row = {
    spot_id: Number(input.spotId),
    user_id: clean(input.userId),
    author_name: clean(input.authorName) || "Veggie Nutzer",
    body: clean(input.body),
    is_public: input.isPublic !== false
  };
  if (Number(input.parentCommentId)) row.parent_comment_id = Number(input.parentCommentId);

  const { data, error } = await getSupabase()
    .from("spot_comments")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return fromCommentRow(data);
}

export async function deleteComment(input) {
  const commentId = Number(input.commentId);
  const userId = clean(input.userId);
  if (!commentId) throw new Error("Kommentar-ID fehlt.");
  if (!userId) throw new Error("User-ID fehlt.");

  const { error } = await getSupabase()
    .from("spot_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId);

  if (error) throw error;
  return { deleted: true };
}

function fromProfileRow(row) {
  return {
    id: row.id,
    profileName: row.profile_name,
    avatarUrl: row.avatar_url || "",
    premiumStatus: row.premium_status || "free",
    premiumPlan: row.premium_plan || "free",
    premiumUntil: row.premium_until || null,
    isPremium: isPremiumProfile(row),
    dietMode: row.diet_mode || "vegan",
    warningIngredients: Array.isArray(row.warning_ingredients) ? row.warning_ingredients : ["milch", "ei", "gelatine", "honig"],
    publicSpots: Boolean(row.public_spots),
    publicScans: Boolean(row.public_scans),
    publicComments: Boolean(row.public_comments)
  };
}

function fromFavoriteRow(row) {
  return {
    barcode: row.barcode,
    name: row.name,
    status: row.status,
    imageUrl: row.image_url || "",
    reason: row.reason || "",
    createdAt: row.created_at
  };
}

function isPremiumProfile(row) {
  const status = clean(row.premium_status || "free");
  if (!["active", "trialing"].includes(status)) return false;
  if (!row.premium_until) return true;
  return new Date(row.premium_until).getTime() > Date.now();
}

function fromScanRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.scan_type,
    title: row.title,
    subtitle: row.subtitle || "",
    payload: row.payload || {},
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at
  };
}

function fromCommentRow(row) {
  return {
    id: row.id,
    spotId: row.spot_id,
    userId: row.user_id,
    author: row.author_name,
    text: row.body,
    parentId: row.parent_comment_id ? Number(row.parent_comment_id) : null,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at
  };
}

function clean(value) {
  return String(value || "").trim();
}
