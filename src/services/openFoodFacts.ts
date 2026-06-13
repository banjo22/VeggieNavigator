import type { VeggieStatus } from "../data/mockData";

export type ProductResult = {
  barcode?: string;
  name: string;
  status: VeggieStatus;
  reason: string;
  price: string;
  store: string;
  ingredients: Array<{ name: string; problematic: boolean }>;
  imageUrl?: string;
  source: "Open Food Facts";
  alternative: {
    name: string;
    store: string;
    price: string;
    reason: string;
  };
};
