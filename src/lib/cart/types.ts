import type { CatalogProduct, ProductPlan } from "@/lib/catalog/types";

export interface CartItem {
  productId: string;
  planId: string;
  quantity: number;
}

export interface RehydratedCartItem {
  item: CartItem;
  product: Pick<CatalogProduct, "id" | "name" | "slug" | "coverUrl">;
  plan: ProductPlan;
}

export interface CartRehydrationResponse {
  items: RehydratedCartItem[];
  unavailable: CartItem[];
}
