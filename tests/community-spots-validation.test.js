import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCommunitySpotInput } from "../lib/community-spots.js";

const validSpot = {
  name: "  Veganer Marktstand  ",
  place: "Musterstraße 1, Berlin",
  price: "4,50 €",
  status: "vegan",
  category: "Markt",
  lat: 52.52,
  lng: 13.405,
  description: "Frische vegane Snacks",
};

test("community spot input is normalized before persistence", () => {
  const row = normalizeCommunitySpotInput(validSpot);
  assert.equal(row.name, "Veganer Marktstand");
  assert.equal(row.price, "4,50 €");
  assert.equal(row.confirmations, 0);
});

test("community spot rejects invalid coordinates", () => {
  assert.throws(
    () => normalizeCommunitySpotInput({ ...validSpot, lat: 120 }),
    /Koordinaten/,
  );
});

test("community spot rejects unsupported status", () => {
  assert.throws(
    () => normalizeCommunitySpotInput({ ...validSpot, status: "vielleicht" }),
    /Status/,
  );
});
