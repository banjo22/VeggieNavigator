export type DietMode = "vegan" | "vegetarian" | "flexitarian";
export type Suitability =
  "vegan" | "vegetarian" | "not_suitable" | "possibly_adaptable" | "unclear";
export type UserProfile = {
  name: string;
  dietMode: DietMode;
  goal: string;
  exclusions: string[];
  country: string;
  language: string;
};
export type ProductResult = {
  code: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  status: Suitability;
  reason: string;
  ingredients: string[];
  problematicIngredients: string[];
  uncertainIngredients?: string[];
  uncertainties?: string[];
  allergens: string[];
  confidence: "high" | "medium" | "unclear";
  alternatives: Alternative[];
  dataSource?: string;
};
export type Alternative = {
  id: string;
  name: string;
  reason: string;
  status: "vegan" | "vegetarian";
};
export type ScanRecord = {
  id: string;
  type: "barcode" | "ingredients" | "menu";
  createdAt: string;
  title: string;
  result: ProductResult;
};
export type MenuAnalysis = {
  language?: string;
  dishes: {
    name: string;
    description?: string;
    classification: Suitability;
    reason: string;
    problematicIngredients?: string[];
    adaptationSuggestion?: string;
    questionForRestaurant?: string;
    questionForRestaurantGerman?: string;
    questionForRestaurantLocal?: string;
    questionForRestaurantEnglish?: string;
  }[];
  generalNotes: string[];
};
export type CommunitySpot = {
  id: number;
  name: string;
  place: string;
  price: string;
  status: "vegan" | "vegetarisch" | "nicht veggie" | "vegan moeglich";
  category: string;
  confirmed: string;
  confirmations: number;
  viewerConfirmed: boolean;
  likeCount: number;
  dislikeCount: number;
  viewerReaction: "like" | "dislike" | "";
  lat: number;
  lng: number;
  description: string;
  imageDataUrl: string;
  createdBy: string;
  createdByName: string;
};
export type CommunitySpotDraft = Omit<
  CommunitySpot,
  | "id"
  | "confirmed"
  | "viewerConfirmed"
  | "likeCount"
  | "dislikeCount"
  | "viewerReaction"
  | "createdBy"
  | "createdByName"
  | "imageDataUrl"
> & { imageUrl?: string };
export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  provider: string;
};
