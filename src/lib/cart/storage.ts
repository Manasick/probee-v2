import type { CartItem } from "./types";

export const CART_STORAGE_KEY = "probee-cart-v1";
export const CART_VERSION = 1;
export const MAX_CART_ITEM_QUANTITY = 99;
export const MAX_CART_LINES = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidCartIdentity(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function normalizeCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const productId =
    typeof value.productId === "string" ? value.productId.toLowerCase() : "";
  const planId =
    typeof value.planId === "string" ? value.planId.toLowerCase() : "";
  const quantity = value.quantity;

  if (
    !isValidCartIdentity(productId) ||
    !isValidCartIdentity(planId) ||
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_CART_ITEM_QUANTITY
  ) {
    return null;
  }

  return {
    productId,
    planId,
    quantity,
  };
}

function itemKey(item: Pick<CartItem, "productId" | "planId">): string {
  return `${item.productId}:${item.planId}`;
}

function normalizeAndMergeCartItems(items: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  for (const item of items) {
    const key = itemKey(item);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }

    existing.quantity = Math.min(
      MAX_CART_ITEM_QUANTITY,
      existing.quantity + item.quantity,
    );
  }

  return Array.from(merged.values()).slice(0, MAX_CART_LINES);
}

export function normalizeCartItems(value: unknown): CartItem[] {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : null;

  if (!rawItems) {
    return [];
  }

  const normalized: CartItem[] = [];

  for (const rawItem of rawItems) {
    const item = normalizeCartItem(rawItem);

    if (item) {
      normalized.push(item);
    }
  }

  return normalizeAndMergeCartItems(normalized);
}

export function parseStoredCart(value: string | null): CartItem[] {
  if (!value) {
    return [];
  }

  try {
    return normalizeCartItems(JSON.parse(value));
  } catch {
    return [];
  }
}

export function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeStoredCart(items: CartItem[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        version: CART_VERSION,
        items: normalizeCartItems(items),
      }),
    );
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}
