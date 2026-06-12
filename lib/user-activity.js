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
  const row = {
    id: clean(input.id),
    profile_name: clean(input.profileName) || "Veggie Nutzer",
    public_spots: Boolean(input.publicSpots),
    public_scans: Boolean(input.publicScans),
    public_comments: input.publicComments !== false,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getSupabase()
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return fromProfileRow(data);
}

export async function listScans(userId) {
  const { data, error } = await getSupabase()
    .from("scan_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []).map(fromScanRow);
}

export async function createScan(input) {
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

export async function listComments(spotId) {
  const { data, error } = await getSupabase()
    .from("spot_comments")
    .select("*")
    .eq("spot_id", spotId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []).map(fromCommentRow);
}

export async function createComment(input) {
  const { data, error } = await getSupabase()
    .from("spot_comments")
    .insert({
      spot_id: Number(input.spotId),
      user_id: clean(input.userId),
      author_name: clean(input.authorName) || "Veggie Nutzer",
      body: clean(input.body),
      is_public: input.isPublic !== false
    })
    .select("*")
    .single();

  if (error) throw error;
  return fromCommentRow(data);
}

function fromProfileRow(row) {
  return {
    id: row.id,
    profileName: row.profile_name,
    publicSpots: Boolean(row.public_spots),
    publicScans: Boolean(row.public_scans),
    publicComments: Boolean(row.public_comments)
  };
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
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at
  };
}

function clean(value) {
  return String(value || "").trim();
}

