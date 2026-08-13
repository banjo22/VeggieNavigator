import type { User } from "@supabase/supabase-js";
import { decode } from "base64-arraybuffer";
import { randomUUID } from "expo-crypto";
import type { ProductResult, ScanRecord, UserProfile } from "../types";
import { supabase } from "./auth";

function requireClient() {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
  return supabase;
}
export async function loadAccountData(user: User) {
  const client = requireClient();
  const [profile, prefs, scans, favorites] = await Promise.all([
    client
      .from("profiles")
      .select("profile_name,display_name")
      .eq("id", user.id)
      .maybeSingle(),
    client
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("scan_history")
      .select("id,scan_type,title,payload,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("product_favorites")
      .select("barcode,payload,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  for (const result of [profile, prefs, scans, favorites])
    if (result.error) throw result.error;
  const p = prefs.data;
  const accountProfile: UserProfile = {
    name:
      profile.data?.display_name ||
      profile.data?.profile_name ||
      user.user_metadata?.profile_name ||
      user.email?.split("@")[0] ||
      "Du",
    dietMode: mapDiet(p?.diet_type),
    goal: p?.goal || "Ich lebe vegan.",
    exclusions: [...(p?.allergies || []), ...(p?.excluded_ingredients || [])],
    country: p?.country || "DE",
    language: p?.language || "de",
  };
  return {
    profile: accountProfile,
    onboarded: Boolean(p?.onboarding_completed),
    scans: (scans.data || []).flatMap((row) =>
      row.payload?.result
        ? [
            {
              id: String(row.id),
              type: mapScanType(row.scan_type),
              title: row.title,
              result: row.payload.result as ProductResult,
              createdAt: row.created_at,
            },
          ]
        : [],
    ),
    favorites: (favorites.data || []).flatMap((row) =>
      row.payload?.result ? [row.payload.result as ProductResult] : [],
    ),
  };
}
export async function saveAccountProfile(
  user: User,
  profile: UserProfile,
  onboarded = true,
) {
  const client = requireClient();
  const [profileResult, prefsResult] = await Promise.all([
    client.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        profile_name: profile.name,
        display_name: profile.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    ),
    client.from("user_preferences").upsert(
      {
        user_id: user.id,
        diet_type: profile.dietMode,
        goal: profile.goal,
        allergies: [],
        excluded_ingredients: profile.exclusions,
        language: profile.language,
        country: profile.country,
        onboarding_completed: onboarded,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    ),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (prefsResult.error) throw prefsResult.error;
}
export async function saveAccountScan(
  user: User,
  record: ScanRecord,
  requestId: string,
) {
  const { error } = await requireClient()
    .from("scan_history")
    .insert({
      user_id: user.id,
      client_request_id: requestId,
      scan_type:
        record.type === "ingredients"
          ? "ingredient_image"
          : record.type === "menu"
            ? "menu_image"
            : "barcode",
      barcode: record.type === "barcode" ? record.result.code : null,
      classification: record.result.status,
      title: record.title,
      summary: record.result.reason,
      confidence: record.result.confidence,
      payload: { result: record.result },
      is_public: false,
    });
  if (error && error.code !== "23505") throw error;
}
export async function deleteAccountScan(user: User, id: string) {
  const { error } = await requireClient()
    .from("scan_history")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) throw error;
}
export async function clearAccountScans(user: User) {
  const { error } = await requireClient()
    .from("scan_history")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
}
export async function saveAccountFavorite(user: User, result: ProductResult) {
  const { error } = await requireClient()
    .from("product_favorites")
    .upsert(
      {
        user_id: user.id,
        barcode: result.code,
        name: result.name,
        status: result.status,
        image_url: result.imageUrl || null,
        reason: result.reason,
        payload: { result },
      },
      { onConflict: "user_id,barcode" },
    );
  if (error) throw error;
}
export async function deleteAccountFavorite(user: User, barcode: string) {
  const { error } = await requireClient()
    .from("product_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("barcode", barcode);
  if (error) throw error;
}
export async function requestAccountDeletion(user: User) {
  const { error } = await requireClient()
    .from("profiles")
    .update({ account_deletion_requested_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;
}
export async function uploadTemporaryAnalysisImage(
  user: User,
  base64DataUrl: string,
  kind: "ingredient-scans" | "menu-scans",
) {
  const encoded = base64DataUrl.split(",")[1];
  if (!encoded) throw new Error("Das Bild konnte nicht gelesen werden.");
  const client = requireClient();
  const path = `${user.id}/${kind}/${randomUUID()}.jpg`;
  const upload = await client.storage
    .from("user-uploads")
    .upload(path, decode(encoded), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (upload.error) throw upload.error;
  const signed = await client.storage
    .from("user-uploads")
    .createSignedUrl(path, 300);
  if (signed.error) {
    await client.storage.from("user-uploads").remove([path]);
    throw signed.error;
  }
  return {
    url: signed.data.signedUrl,
    remove: async () => {
      await client.storage.from("user-uploads").remove([path]);
    },
  };
}
export async function uploadCommunitySpotImage(
  user: User,
  base64DataUrl: string,
) {
  const encoded = base64DataUrl.split(",")[1];
  if (!encoded) throw new Error("Das Bild konnte nicht gelesen werden.");
  const client = requireClient();
  const path = `${user.id}/spots/${randomUUID()}.jpg`;
  const upload = await client.storage
    .from("community-spot-images")
    .upload(path, decode(encoded), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (upload.error) throw upload.error;
  const { data } = client.storage
    .from("community-spot-images")
    .getPublicUrl(path);
  return {
    url: data.publicUrl,
    remove: async () => {
      await client.storage.from("community-spot-images").remove([path]);
    },
  };
}
function mapDiet(value: unknown): UserProfile["dietMode"] {
  return value === "vegetarian"
    ? "vegetarian"
    : value === "flexitarian"
      ? "flexitarian"
      : "vegan";
}
function mapScanType(value: unknown): ScanRecord["type"] {
  return value === "ingredient_image"
    ? "ingredients"
    : value === "menu_image"
      ? "menu"
      : "barcode";
}
