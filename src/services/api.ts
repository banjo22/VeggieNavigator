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

export async function analyzeIngredientPhoto(imageDataUrl: string, signal?: AbortSignal): Promise<IngredientAnalysis> {
  const response = await fetch(`${API_BASE}/api/analyze-ingredients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, mode: "ingredients" }),
    signal
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "KI-Analyse nicht erreichbar.");
  return data.result;
}

export async function analyzeMenuPhoto(imageDataUrl: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${API_BASE}/api/analyze-ingredients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, mode: "menu" }),
    signal
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Speisekartenanalyse nicht erreichbar.");
  return data.result?.text || data.raw || "";
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const response = await fetch(`${API_BASE}/api/places?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Standortsuche gerade nicht erreichbar.");
  const data = await response.json();
  return data.items || [];
}
