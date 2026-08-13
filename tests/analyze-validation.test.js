import test from "node:test";
import assert from "node:assert/strict";
import {
  validateIngredientResult,
  validateMenuResult,
} from "../api/analyze-ingredients.js";
test("invalid ingredient model output fails closed", () => {
  const result = validateIngredientResult({
    classification: "certainly_vegan",
    confidence: 42,
    problematicIngredients: "none",
  });
  assert.equal(result.classification, "unclear");
  assert.equal(result.confidence, "low");
  assert.deepEqual(result.problematicIngredients, []);
});
test("structured ingredients are reduced to the public contract", () => {
  const result = validateIngredientResult({
    classification: "not_suitable",
    confidence: "high",
    summary: "Enthält Molke",
    detectedIngredients: [{ name: "Molke", status: "problematic" }],
    problematicIngredients: [
      { name: "Molke", reason: "Milchbestandteil", sourceType: "animal" },
    ],
    possibleAllergens: ["Milch"],
    uncertainties: [],
    suggestedAlternatives: [{ name: "Haferdrink", reason: "pflanzlich" }],
  });
  assert.equal(result.problematicIngredients[0].name, "Molke");
  assert.deepEqual(result.possibleAllergens, ["Milch"]);
});
test("menu classifications are validated", () => {
  const result = validateMenuResult({
    dishes: [{ name: "Unklar", classification: "guaranteed", reason: "" }],
    generalNotes: [],
  });
  assert.equal(result.dishes[0].classification, "unclear");
});

test("adaptable menu dishes retain concrete restaurant guidance", () => {
  const result = validateMenuResult({
    language: "de",
    dishes: [
      {
        name: "Pasta al pomodoro",
        classification: "possibly_adaptable",
        reason: "Parmesan ist möglich.",
        problematicIngredients: ["Parmesan"],
        adaptationSuggestion: "Ohne Parmesan bestellen.",
        questionForRestaurant: "Ist Parmesan oder Butter enthalten?",
        questionForRestaurantGerman: "Ist Parmesan oder Butter enthalten?",
        questionForRestaurantLocal: "",
        questionForRestaurantEnglish: "Does this contain Parmesan or butter?",
      },
    ],
    generalNotes: [],
  });
  assert.equal(result.dishes.length, 1);
  assert.equal(result.dishes[0].classification, "possibly_adaptable");
  assert.match(result.dishes[0].questionForRestaurant, /Parmesan/);
  assert.match(result.dishes[0].questionForRestaurantGerman, /Parmesan/);
  assert.equal(result.dishes[0].questionForRestaurantLocal, "");
  assert.match(result.dishes[0].questionForRestaurantEnglish, /Does/);
});

test("foreign menu questions retain German and local versions", () => {
  const result = validateMenuResult({
    language: "it",
    dishes: [
      {
        name: "Mushroom risotto",
        classification: "possibly_adaptable",
        reason: "Das Gericht kann Butter oder Parmesan enthalten.",
        questionForRestaurant: "Contiene burro o parmigiano?",
        questionForRestaurantGerman:
          "Enthält dieses Gericht Butter oder Parmesan?",
        questionForRestaurantLocal: "Contiene burro o parmigiano?",
        questionForRestaurantEnglish: "Does this contain butter or Parmesan?",
      },
    ],
    generalNotes: ["Die Zutaten sind nicht vollständig angegeben."],
  });

  assert.equal(result.language, "it");
  assert.match(result.dishes[0].reason, /Butter/);
  assert.match(result.dishes[0].questionForRestaurantGerman, /Enthält/);
  assert.match(result.dishes[0].questionForRestaurantLocal, /Contiene/);
  assert.match(result.dishes[0].questionForRestaurantEnglish, /Does/);
});
