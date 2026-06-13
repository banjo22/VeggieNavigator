const animalSignals = ["parmesan", "milch", "kaese", "käse", "butter", "sahne", "molke", "ei", "honig", "gelatine", "huhn", "haehnchen", "hähnchen", "fleisch", "fisch", "speck", "sardelle"];
const nonVeggieSignals = ["huhn", "haehnchen", "hähnchen", "fleisch", "fisch", "speck", "sardelle", "gelatine", "rind", "schwein"];

export async function fetchProductByBarcode(barcode) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
  if (!response.ok) {
    throw new Error("Open Food Facts ist gerade nicht erreichbar.");
  }

  const data = await response.json();
  if (data.status !== 1 || !data.product) {
    return null;
  }

  return mapOpenFoodFactsProduct(data.product, barcode);
}

function mapOpenFoodFactsProduct(product, barcode) {
  const labels = product.labels_tags ?? [];
  const ingredientText = product.ingredients_text_de || product.ingredients_text || "";
  const lowerIngredients = ingredientText.toLowerCase();
  const hasVeganLabel = labels.some((label) => label.includes("vegan"));
  const hasVegetarianLabel = labels.some((label) => label.includes("vegetarian") || label.includes("vegetarisch"));
  const hasNonVeggieSignal = nonVeggieSignals.some((signal) => lowerIngredients.includes(signal));
  const hasAnimalSignal = animalSignals.some((signal) => lowerIngredients.includes(signal));

  const status = hasVeganLabel
    ? "vegan"
    : hasNonVeggieSignal
      ? "nicht veggie"
      : hasVegetarianLabel || hasAnimalSignal
        ? "vegetarisch"
        : "vegetarisch";

  const reason = hasVeganLabel
    ? "Open Food Facts fuehrt das Produkt mit veganem Label."
    : hasNonVeggieSignal
      ? "In den Zutaten wurden Hinweise auf Fleisch, Fisch oder Gelatine gefunden."
      : hasAnimalSignal
        ? "Die Zutaten deuten auf tierische Bestandteile hin. Fuer vegan bitte genauer pruefen."
        : "Keine klaren Fleisch-/Fisch-Hinweise gefunden. Bitte Zutaten bei Unsicherheit gegenchecken.";

  const ingredientNames = ingredientText
    .split(/[,.;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    barcode,
    name: product.product_name || product.generic_name || "Unbenanntes Produkt",
    status,
    reason,
    price: "Preis nicht in Open Food Facts",
    store: product.stores || "Laden nicht angegeben",
    imageUrl: product.image_front_small_url,
    source: "Open Food Facts",
    ingredients: ingredientNames.length
      ? ingredientNames.map((name) => ({ name, problematic: animalSignals.some((signal) => name.toLowerCase().includes(signal)) }))
      : [{ name: "Keine Zutatenliste verfuegbar", problematic: false }],
    alternative: {
      name: "Vegane Alternative in der Naehe suchen",
      store: "Community-Funde",
      price: "je nach Laden",
      reason: "Als naechster Schritt koennte die App lokale Community-Funde passend zum Produkt anzeigen."
    }
  };
}
