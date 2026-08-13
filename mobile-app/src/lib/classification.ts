import type { DietMode, ProductResult, Suitability } from "../types";

export function personalizeStatus(
  status: Suitability,
  diet: DietMode,
): Suitability {
  if (diet === "vegan")
    return status === "vegetarian" ? "not_suitable" : status;
  if (diet === "vegetarian" && status === "vegetarian") return "vegetarian";
  return status;
}

export function isMenuDishFitting(status: Suitability, diet: DietMode) {
  if (diet === "vegan") return status === "vegan";
  return status === "vegan" || status === "vegetarian";
}

export function isMenuDishRecommended(status: Suitability, diet: DietMode) {
  return isMenuDishFitting(status, diet) || status === "possibly_adaptable";
}

export function normalizeProduct(
  raw: Record<string, unknown>,
  diet: DietMode,
): ProductResult {
  const product = (raw.product ?? raw) as Record<string, unknown>;
  const rawStatus = mapStatus(
    String(
      product.classification ??
        product.status ??
        product.veggieStatus ??
        "unclear",
    ),
  );
  return {
    code: String(product.code ?? product.barcode ?? ""),
    name: String(product.name ?? product.productName ?? "Unbekanntes Produkt"),
    brand: typeof product.brand === "string" ? product.brand : undefined,
    imageUrl:
      typeof product.imageUrl === "string" ? product.imageUrl : undefined,
    status: personalizeStatus(rawStatus, diet),
    reason: String(
      product.summary ??
        product.reason ??
        product.explanation ??
        "Die vorhandenen Daten reichen für eine sichere Bewertung nicht aus.",
    ),
    ingredients: ingredientNames(
      product.ingredients ?? product.detectedIngredients,
    ),
    problematicIngredients: ingredientNames(product.problematicIngredients),
    uncertainIngredients: uncertainIngredientNames(product.detectedIngredients),
    uncertainties: strings(product.uncertainties),
    allergens: strings(product.possibleAllergens ?? product.allergens),
    confidence: mapConfidence(product.confidence),
    alternatives: alternatives(product.suggestedAlternatives),
    dataSource:
      typeof product.source === "string" ? product.source : "Open Food Facts",
  };
}

export function mapStatus(value: string): Suitability {
  const v = value.toLowerCase();
  if (v === "vegan") return "vegan";
  if (v.includes("vegetar")) return "vegetarian";
  if (v.includes("anpass") || v.includes("möglich"))
    return "possibly_adaptable";
  if (v.includes("nicht") || v.includes("non") || v === "not_suitable")
    return "not_suitable";
  return "unclear";
}
function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
function ingredientNames(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === "string"
          ? [item]
          : item && typeof item === "object" && "name" in item
            ? [String(item.name)]
            : [],
      )
    : [];
}
function uncertainIngredientNames(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        item &&
        typeof item === "object" &&
        "name" in item &&
        "status" in item &&
        item.status === "unclear"
          ? [String(item.name)]
          : [],
      )
    : [];
}
function alternatives(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item, index) =>
        item && typeof item === "object" && "name" in item
          ? [
              {
                id: `ai-${index}`,
                name: String(item.name),
                reason:
                  "reason" in item
                    ? String(item.reason)
                    : "Pflanzliche Alternative",
                status: "vegan" as const,
              },
            ]
          : [],
      )
    : [];
}
function mapConfidence(value: unknown): ProductResult["confidence"] {
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  const n = Number(value);
  return n >= 0.8 ? "high" : n >= 0.5 ? "medium" : "unclear";
}
