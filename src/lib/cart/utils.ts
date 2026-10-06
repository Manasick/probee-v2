import type { CartItem } from "./types";
import {
  isValidCartIdentity,
  MAX_CART_ITEM_QUANTITY,
  MAX_CART_LINES,
  normalizeCartItem,
} from "./storage";

export function cartItemKey(item: Pick<CartItem, "productId" | "planId">): string {
  return `${item.productId}:${item.planId}`;
}

export function mergeCartItems(items: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  for (const item of items) {
    const normalized = normalizeCartItem(item);

    if (!normalized) {
      continue;
    }

    const key = cartItemKey(normalized);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, normalized);
      continue;
    }

    existing.quantity = Math.min(
      MAX_CART_ITEM_QUANTITY,
      existing.quantity + normalized.quantity,
    );
  }

  return Array.from(merged.values()).slice(0, MAX_CART_LINES);
}

export function addCartItem(
  items: CartItem[],
  productId: string,
  planId: string,
  quantity = 1,
): CartItem[] {
  if (
    !isValidCartIdentity(productId) ||
    !isValidCartIdentity(planId) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_CART_ITEM_QUANTITY
  ) {
    return items;
  }

  const normalizedProductId = productId.toLowerCase();
  const normalizedPlanId = planId.toLowerCase();
  const key = `${normalizedProductId}:${normalizedPlanId}`;
  const next = items.map((item) => ({ ...item }));
  const existingIndex = next.findIndex((item) => cartItemKey(item) === key);

  if (existingIndex >= 0) {
    next[existingIndex].quantity = Math.min(
      MAX_CART_ITEM_QUANTITY,
      next[existingIndex].quantity + quantity,
    );
    return mergeCartItems(next);
  }

  if (next.length >= MAX_CART_LINES) {
    return items;
  }

  next.push({
    productId: normalizedProductId,
    planId: normalizedPlanId,
    quantity,
  });

  return mergeCartItems(next);
}

export function updateCartItemQuantity(
  items: CartItem[],
  productId: string,
  planId: string,
  quantity: number,
): CartItem[] {
  if (
    !isValidCartIdentity(productId) ||
    !isValidCartIdentity(planId) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_CART_ITEM_QUANTITY
  ) {
    return items;
  }

  const key = `${productId.toLowerCase()}:${planId.toLowerCase()}`;

  return items.map((item) =>
    cartItemKey(item) === key ? { ...item, quantity } : item,
  );
}

export function removeCartItem(
  items: CartItem[],
  productId: string,
  planId: string,
): CartItem[] {
  if (!isValidCartIdentity(productId) || !isValidCartIdentity(planId)) {
    return items;
  }

  const key = `${productId.toLowerCase()}:${planId.toLowerCase()}`;

  return items.filter((item) => cartItemKey(item) !== key);
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}
