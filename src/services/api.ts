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
  publicSpots: boolean;
  publicScans: boolean;
  publicComments: boolean;
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
};

export type IngredientAnalysis = {
  status: "vegan" | "vegetarisch" | "nicht veggie" | "unklar";
  explanation: string;
  problematicIngredients: string[];
  confidence: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchPriceOptions(barcode: string): Promise<PriceOption[]> {
  const response = await fetch(`${API_BASE}/api/prices?barcode=${encodeURIComponent(barcode)}`);
  if (!response.ok) throw new Error("Preisvergleich gerade nicht erreichbar.");
  const data = await response.json();
  return data.items || [];
}

export async function fetchProductByBarcode(barcode: string, accessToken = ""): Promise<{ product: ProductResult | null; quota?: ScanQuota }> {
  const response = await fetch(`${API_BASE}/api/product?barcode=${encodeURIComponent(barcode)}`, {
    headers: authHeaders(accessToken)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Produktdaten nicht erreichbar.");
  return { product: data.product || null, quota: data.quota };
}

export type ScanQuota = {
  limit: number;
  used: number;
  remaining: number;
  usageDate: string;
  subjectType: "guest" | "user";
};

export async function analyzeIngredientPhoto(imageDataUrl: string, signal?: AbortSignal, accessToken = ""): Promise<{ result: IngredientAnalysis; quota?: ScanQuota }> {
  const response = await fetch(`${API_BASE}/api/analyze-ingredients`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ imageDataUrl, mode: "ingredients" }),
    signal
  });
  const data = await response.json();
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
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Speisekartenanalyse nicht erreichbar.");
  return { text: data.result?.text || data.raw || "", quota: data.quota };
}

function authHeaders(accessToken = ""): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const response = await fetch(`${API_BASE}/api/places?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Standortsuche gerade nicht erreichbar.");
  const data = await response.json();
  return data.items || [];
}

export async function fetchCommunitySpots() {
  const response = await fetch(`${API_BASE}/api/community-spots`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Community-Spots nicht erreichbar.");
  return data.items || [];
}

export async function createCommunitySpot(spot: CommunitySpotPayload) {
  const response = await fetch(`${API_BASE}/api/community-spots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spot)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Spot konnte nicht gespeichert werden.");
  return data.item;
}

export async function confirmCommunitySpot(id: number) {
  const response = await fetch(`${API_BASE}/api/community-spots/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Spot konnte nicht bestaetigt werden.");
  return data.item;
}

export async function fetchProfile(userId: string) {
  const response = await fetch(`${API_BASE}/api/profile?userId=${encodeURIComponent(userId)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Profil nicht erreichbar.");
  return data.profile;
}

export async function saveProfile(profile: ProfilePayload) {
  const response = await fetch(`${API_BASE}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Profil konnte nicht gespeichert werden.");
  return data.profile;
}

export async function fetchScans(userId: string) {
  const response = await fetch(`${API_BASE}/api/scans?userId=${encodeURIComponent(userId)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Scans nicht erreichbar.");
  return data.items || [];
}

export async function saveScan(scan: ScanPayload) {
  const response = await fetch(`${API_BASE}/api/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scan)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Scan konnte nicht gespeichert werden.");
  return data.item;
}

export async function fetchComments(spotId: number) {
  const response = await fetch(`${API_BASE}/api/comments?spotId=${encodeURIComponent(String(spotId))}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Kommentare nicht erreichbar.");
  return data.items || [];
}

export async function saveComment(comment: CommentPayload) {
  const response = await fetch(`${API_BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comment)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Kommentar konnte nicht gespeichert werden.");
  return data.item;
}
