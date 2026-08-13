import type {
  CommunitySpot,
  CommunitySpotDraft,
  DietMode,
  MenuAnalysis,
  PlaceSuggestion,
  ProductResult,
} from "../types";
import { normalizeProduct } from "./classification";
import { supabase } from "./auth";

const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiRequestInit = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  if (!baseUrl)
    throw new ApiError(
      "Backend-Adresse fehlt. Setze EXPO_PUBLIC_API_BASE_URL.",
      0,
    );
  const controller = new AbortController();
  const { timeoutMs = 30_000, ...fetchInit } = init ?? {};
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = createRequestId();
  const started = Date.now();
  try {
    const token =
      (await supabase?.auth.getSession())?.data.session?.access_token ?? "";
    if (__DEV__)
      console.info("[api:start]", {
        requestId,
        path,
        method: init?.method ?? "GET",
      });
    const response = await fetch(`${baseUrl}${path}`, {
      ...fetchInit,
      signal: fetchInit.signal ?? controller.signal,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Request-ID": requestId,
        "X-Veggie-Client": "mobile",
        ...fetchInit.headers,
      },
    });
    const data = (await response.json().catch(() => null)) as T & {
      error?: string;
    };
    if (!response.ok)
      throw new ApiError(
        data?.error ?? "Die Anfrage ist fehlgeschlagen.",
        response.status,
      );
    if (__DEV__)
      console.info("[api:end]", {
        requestId,
        status: response.status,
        durationMs: Date.now() - started,
      });
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError")
      throw new ApiError("Die Anfrage hat zu lange gedauert.", 408);
    const message = __DEV__
      ? "Backend nicht erreichbar. Prüfe EXPO_PUBLIC_API_BASE_URL und ob Handy und Computer dasselbe Netzwerk verwenden."
      : "Keine Verbindung zum Backend.";
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeout);
  }
}
function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function getProduct(barcode: string, diet: DietMode, token = "") {
  const raw = await request<Record<string, unknown>>(
    `/api/product?barcode=${encodeURIComponent(barcode)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!raw.product) return null;
  return normalizeProduct(raw, diet);
}

export async function analyzeImage(
  imageDataUrl: string | string[],
  mode: "ingredients" | "menu",
  diet: DietMode,
  token = "",
  referenceCode = "",
  exclusions: string[] = [],
  userLanguage = "de",
): Promise<ProductResult | MenuAnalysis> {
  const raw = await request<{ result: Record<string, unknown> }>(
    "/api/analyze-ingredients",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(
        mode === "menu"
          ? {
              imageDataUrls: Array.isArray(imageDataUrl)
                ? imageDataUrl
                : [imageDataUrl],
              mode,
              diet,
              exclusions,
              userLanguage,
            }
          : {
              imageDataUrl: Array.isArray(imageDataUrl)
                ? imageDataUrl[0]
                : imageDataUrl,
              mode,
              diet,
              exclusions,
              userLanguage,
            },
      ),
      timeoutMs: mode === "menu" ? 125_000 : 60_000,
    },
  );
  return mode === "ingredients"
    ? normalizeProduct(
        {
          ...raw.result,
          code: referenceCode || `photo-${Date.now()}`,
          name: raw.result.productName || "Fotografierte Zutatenliste",
        },
        diet,
      )
    : (raw.result as unknown as MenuAnalysis);
}

export async function fetchCommunitySpots() {
  const data = await request<{ items: CommunitySpot[] }>(
    "/api/community-spots",
  );
  return data.items ?? [];
}
export async function createCommunitySpot(draft: CommunitySpotDraft) {
  const data = await request<{ item: CommunitySpot }>("/api/community-spots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  return data.item;
}
export async function confirmCommunitySpot(id: number) {
  const data = await request<{ item: CommunitySpot }>(
    "/api/community-spots/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    },
  );
  return data.item;
}
export async function reactToCommunitySpot(
  id: number,
  reaction: "like" | "dislike" | "",
) {
  const data = await request<{ item: CommunitySpot }>(
    "/api/community-spots/reaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reaction }),
    },
  );
  return data.item;
}
export async function searchPlaces(query: string, signal?: AbortSignal) {
  const data = await request<{ items: PlaceSuggestion[] }>(
    `/api/places?q=${encodeURIComponent(query)}`,
    { signal },
  );
  return data.items ?? [];
}
