export type VeggieStatus = "vegan" | "vegetarisch" | "nicht veggie" | "vegan moeglich";

export const featureCards = [
  { title: "Produkt checken", text: "Barcode suchen und Zutaten schnell einordnen.", target: "scanner" as const },
  { title: "Speisekarte scannen", text: "Gerichte erkennen und veggie Optionen finden.", target: "scanner" as const },
  { title: "In der Naehe entdecken", text: "Besondere Spots aus Supermarkt, Cafe und Restaurant.", target: "map" as const },
  { title: "Essen hinzufuegen", text: "Teile einen Spot, der anderen wirklich hilft.", target: "add" as const }
];

export const recommendations: Array<{ label: string; value: string }> = [];

export const categories = ["Neu entdeckt", "Geheimtipps", "Guenstig", "Suesses", "Restaurants", "Supermarkt-Spots"];

export type CommunitySpot = {
  id: number;
  name: string;
  place: string;
  distance: string;
  price: string;
  status: VeggieStatus;
  category: string;
  confirmed: string;
  rating: string;
  lat: number;
  lng: number;
  description: string;
};

export const initialFinds: CommunitySpot[] = [];

export const pricing = [
  { name: "Free", price: "0 EUR", perks: ["5 Scans pro Woche", "2 Speisekarten-Analysen", "Community-Spots ansehen"] },
  { name: "Premium", price: "4,99 EUR/Monat", perks: ["Unbegrenzte Scans", "Produkt-Alerts in der Naehe", "Staedte-Guides", "Lieblingsspots speichern"] }
];
