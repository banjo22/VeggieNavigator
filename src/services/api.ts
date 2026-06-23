import type { ProductResult } from "./openFoodFacts";

export type PriceOption = {
  store: string;
  address: string;
  city: string;
  country: string;
  price: number;
  currency: string;
  date: string;
  discounted: boolean;
  source: string;
};

export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  provider: string;
};

export type CommunitySpotPayload = {
  name: string;
  place: string;
  price: string;
  status: string;
  category: string;
  confirmations: number;
  lat: number;
  lng: number;
  description: string;
  imageDataUrl?: string;
  createdBy?: string;
  createdByName?: string;
};

export type ProfilePayload = {
  id: string;
  profileName: string;
  avatarUrl?: string;
  dietMode?: string;
  warningIngredients?: string[];
  publicSpots: boolean;
  publicScans: boolean;
  publicComments?: boolean;
};

export type ProductFavoritePayload = {
  userId: string;
  barcode: string;
  name: string;
  status: string;
  imageUrl?: string;
  reason?: string;
  createdAt?: string;
};

export type ScanPayload = {
  userId: string;
  type: string;
  title: string;
  subtitle: string;
  payload: unknown;
  isPublic: boolean;
};

export type CommentPayload = {
  spotId: number;
  userId: string;
  authorName: string;
  body: string;
  isPublic: boolean;
  parentCommentId?: number | null;
};

export type IngredientAnalysis = {
  status: "vegan" | "vegetarisch" | "nicht veggie" | "unklar";
  explanation: string;
  problematicIngredients: string[];
  detectedIngredients?: string[];
  confidence: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchPriceOptions(barcode: string): Promise<PriceOption[]> {
  const response = await fetch(`${API_BASE}/api/prices?barcode=${encodeURIComponent(barcode)}`);
  if (!response.ok) throw new Error("Preisvergleich gerade nicht erreichbar.");
  const data = await readJsonResponse(response);
  return data.items || [];
}

export async function fetchProductByBarcode(barcode: string, accessToken = ""): Promise<{ product: ProductResult | null; quota?: ScanQuota }> {
  const response = await fetch(`${API_BASE}/api/product?barcode=${encodeURIComponent(barcode)}`, {
    headers: authHeaders(accessToken)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Produktdaten nicht erreichbar.");
  return { product: data.product || null, quota: data.quota };
}

export type ScanQuota = {
  limit: number | null;
  used: number;
  remaining: number | null;
  usageDate: string;
  subjectType: "guest" | "user";
  premium: boolean;
  premiumStatus: string;
  premiumPlan: string;
  premiumUntil: string | null;
};

export async function fetchScanQuota(accessToken = ""): Promise<ScanQuota> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/api/scan-quota`, {
        headers: authHeaders(accessToken)
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Scan-Limit nicht erreichbar.");
      if (!data.quota) throw new Error("Scan-Limit-Antwort war unvollstÃ¤ndig.");
      return data.quota;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(350);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Scan-Limit nicht erreichbar.");
}

export async function analyzeIngredientPhoto(imageDataUrl: string, signal?: AbortSignal, accessToken = ""): Promise<{ result: IngredientAnalysis; quota?: ScanQuota }> {
  const response = await fetch(`${API_BASE}/api/analyze-ingredients`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ imageDataUrl, mode: "ingredients" }),
    signal
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "KI-Analyse nicht erreichbar.");
  return { result: data.result, quota: data.quota };
}

export async function analyzeMenuPhoto(imageDataUrls: string[], signal?: AbortSignal, accessToken = ""): Promise<{ text: string; quota?: ScanQuota }> {
  const response = await fetch(`${API_BASE}/api/analyze-ingredients`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ imageDataUrl: imageDataUrls[0], imageDataUrls, mode: "menu" }),
    signal
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Speisekartenanalyse nicht erreichbar.");
  return { text: data.result?.text || data.raw || "", quota: data.quota };
}

function authHeaders(accessToken = ""): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("API hat leer geantwortet. Bitte API-Server neu starten und erneut versuchen.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("API hat keine gÃ¼ltige JSON-Antwort geliefert. Bitte API-Server prÃ¼fen.");
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const response = await fetch(`${API_BASE}/api/places?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error("Standortsuche gerade nicht erreichbar.");
  const data = await readJsonResponse(response);
  return data.items || [];
}

export async function fetchCommunitySpots(userId = "", guestId = "") {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (guestId) params.set("guestId", guestId);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE}/api/community-spots${query}`);
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Community-Spots nicht erreichbar.");
  return data.items || [];
}

export async function createCommunitySpot(spot: CommunitySpotPayload) {
  const response = await fetch(`${API_BASE}/api/community-spots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spot)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Spot konnte nicht gespeichert werden.");
  return data.item;
}

export async function claimCommunitySpots(userId: string, userName: string, spotIds: number[]) {
  if (spotIds.length === 0) return [];
  const response = await fetch(`${API_BASE}/api/community-spots`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, userName, spotIds })
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Spots konnten nicht synchronisiert werden.");
  return data.items;
}

export async function confirmCommunitySpot(id: number, userId = "", guestId = "") {
  const response = await fetch(`${API_BASE}/api/community-spots/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, userId, guestId })
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Spot konnte nicht bestÃ¤tigt werden.");
  return data.item;
}

export async function reactToCommunitySpot(id: number, reaction: "like" | "dislike" | "", userId = "", guestId = "") {
  const response = await fetch(`${API_BASE}/api/community-spots/reaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reaction, userId, guestId })
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Reaktion konnte nicht gespeichert werden.");
  return data.item;
}

export async function fetchProfile(userId: string) {
  const response = await fetch(`${API_BASE}/api/profile?userId=${encodeURIComponent(userId)}`);
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Profil nicht erreichbar.");
  return data.profile;
}

export async function saveProfile(profile: ProfilePayload) {
  const response = await fetch(`${API_BASE}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Profil konnte nicht gespeichert werden.");
  return data.profile;
}

export async function fetchProductFavorites(userId: string) {
  const response = await fetch(`${API_BASE}/api/product-favorites?userId=${encodeURIComponent(userId)}`);
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Gemerkte Produkte nicht erreichbar.");
  return data.items || [];
}

export async function saveProductFavorite(favorite: ProductFavoritePayload) {
  const response = await fetch(`${API_BASE}/api/product-favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(favorite)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Produkt konnte nicht gemerkt werden.");
  return data.item;
}

export async function deleteProductFavorite(userId: string, barcode: string) {
  const response = await fetch(`${API_BASE}/api/product-favorites?userId=${encodeURIComponent(userId)}&barcode=${encodeURIComponent(barcode)}`, {
    method: "DELETE"
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Produkt konnte nicht entfernt werden.");
  return data;
}

export async function fetchScans(userId: string) {
  const response = await fetch(`${API_BASE}/api/scans?userId=${encodeURIComponent(userId)}`);
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Scans nicht erreichbar.");
  return data.items || [];
}

export async function saveScan(scan: ScanPayload) {
  const response = await fetch(`${API_BASE}/api/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scan)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Scan konnte nicht gespeichert werden.");
  return data.item;
}

export async function deleteScan(userId: string, scanId: number) {
  const response = await fetch(`${API_BASE}/api/scans?userId=${encodeURIComponent(userId)}&scanId=${encodeURIComponent(String(scanId))}`, {
    method: "DELETE"
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Scan konnte nicht gelÃ¶scht werden.");
  return data;
}

export async function deleteAllScans(userId: string) {
  const response = await fetch(`${API_BASE}/api/scans?userId=${encodeURIComponent(userId)}&all=true`, {
    method: "DELETE"
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Scans konnten nicht gelÃ¶scht werden.");
  return data;
}

export async function fetchComments(spotId: number) {
  const response = await fetch(`${API_BASE}/api/comments?spotId=${encodeURIComponent(String(spotId))}`);
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Kommentare nicht erreichbar.");
  return data.items || [];
}

export async function saveComment(comment: CommentPayload) {
  const response = await fetch(`${API_BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comment)
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Kommentar konnte nicht gespeichert werden.");
  return data.item;
}

export async function deleteComment(userId: string, commentId: number) {
  const response = await fetch(`${API_BASE}/api/comments?userId=${encodeURIComponent(userId)}&commentId=${encodeURIComponent(String(commentId))}`, {
    method: "DELETE"
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Kommentar konnte nicht gelÃ¶scht werden.");
  return data;
}

