export type VeggieStatus = "vegan" | "vegetarisch" | "nicht veggie" | "vegan möglich";

export const featureCards = [
  { title: "Produkt checken", text: "Barcode suchen und Zutaten schnell einordnen.", target: "scanner" as const },
  { title: "Speisekarte scannen", text: "Gerichte erkennen und vegane/vegetarische Optionen finden.", target: "scanner" as const },
  { title: "In der Nähe entdecken", text: "Besondere Spots aus Supermarkt, Café und Restaurant.", target: "map" as const },
  { title: "Essen hinzufügen", text: "Teile einen Spot, der anderen wirklich hilft.", target: "add" as const }
];

export const recommendations: Array<{ label: string; value: string }> = [];

export const categories = ["Restaurant", "Café & Bäckerei", "Supermarkt", "Imbiss", "Mensa/Kantine", "Lieferdienst", "Sonstiges"];

export type CommunitySpot = {
  id: number;
  name: string;
  place: string;
  distance?: string;
  price: string;
  status: VeggieStatus;
  category: string;
  confirmed: string;
  lat: number;
  lng: number;
  description: string;
  imageDataUrl?: string;
  createdBy?: string;
  createdByName?: string;
};

export const initialFinds: CommunitySpot[] = [];

export const pricing = [
  { name: "Free", price: "0 EUR", perks: ["3 Scans pro Tag ohne Login", "5 Scans pro Tag mit Profil", "Community-Spots ansehen"] },
  { name: "Premium", price: "4,99 €/Monat", perks: ["Unbegrenzte Scans", "Produkt-Alerts in der Nähe", "Städte-Guides", "Lieblingsspots speichern"] }
];
