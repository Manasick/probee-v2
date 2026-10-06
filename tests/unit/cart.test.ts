import { describe, expect, it } from "vitest";
import {
  MAX_CART_ITEM_QUANTITY,
  MAX_CART_LINES,
  normalizeCartItem,
  normalizeCartItems,
  parseStoredCart,
} from "@/lib/cart/storage";
import {
  addCartItem,
  cartItemKey,
  getCartItemCount,
  mergeCartItems,
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/cart/utils";

const productA = "00000000-0000-4000-8000-000000000001";
const productB = "00000000-0000-4000-8000-000000000002";
const planA = "00000000-0000-4000-8000-000000000101";
const planB = "00000000-0000-4000-8000-000000000102";

describe("cart storage normalization", () => {
  it("normalizes a valid cart item", () => {
    expect(
      normalizeCartItem({
        productId: productA.toUpperCase(),
        planId: planA.toUpperCase(),
        quantity: 2,
        ignored: true,
      }),
    ).toEqual({ productId: productA, planId: planA, quantity: 2 });
  });

  it("rejects malformed ids and quantities", () => {
    expect(normalizeCartItem({ productId: "x", planId: planA, quantity: 1 })).toBeNull();
    expect(normalizeCartItem({ productId: productA, planId: planA, quantity: 0 })).toBeNull();
    expect(normalizeCartItem({ productId: productA, planId: planA, quantity: 100 })).toBeNull();
    expect(normalizeCartItem({ productId: productA, planId: planA, quantity: 1.5 })).toBeNull();
  });

  it("merges duplicate lines and caps quantity", () => {
    expect(
      normalizeCartItems([
        { productId: productA, planId: planA, quantity: 60 },
        { productId: productA, planId: planA, quantity: 60 },
        { productId: productB, planId: planB, quantity: 2 },
      ]),
    ).toEqual([
      { productId: productA, planId: planA, quantity: MAX_CART_ITEM_QUANTITY },
      { productId: productB, planId: planB, quantity: 2 },
    ]);
  });

  it("supports the stored object shape and rejects malformed JSON", () => {
    const stored = JSON.stringify({
      version: 1,
      items: [{ productId: productA, planId: planA, quantity: 1 }],
    });

    expect(parseStoredCart(stored)).toEqual([
      { productId: productA, planId: planA, quantity: 1 },
    ]);
    expect(parseStoredCart("{not-json")).toEqual([]);
    expect(parseStoredCart(null)).toEqual([]);
  });

  it("bounds normalized cart lines to the maximum", () => {
    const items = Array.from({ length: MAX_CART_LINES + 5 }, (_, index) => ({
      productId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      planId: `00000000-0000-4000-8000-${String(index + 1001).padStart(12, "0")}`,
      quantity: 1,
    }));
    expect(normalizeCartItems(items)).toHaveLength(MAX_CART_LINES);
  });
});

describe("cart utilities", () => {
  it("builds a stable identity key", () => {
    expect(cartItemKey({ productId: productA, planId: planA })).toBe(
      `${productA}:${planA}`,
    );
  });

  it("adds new items and merges duplicate items", () => {
    let items = addCartItem([], productA, planA);
    items = addCartItem(items, productA.toUpperCase(), planA.toUpperCase(), 3);

    expect(items).toEqual([
      { productId: productA, planId: planA, quantity: 4 },
    ]);
  });

  it("rejects invalid additions and preserves the original array", () => {
    const items = [{ productId: productA, planId: planA, quantity: 1 }];
    expect(addCartItem(items, "bad", planA, 1)).toBe(items);
    expect(addCartItem(items, productA, planA, 0)).toBe(items);
  });

  it("does not add beyond the line limit", () => {
    const items = Array.from({ length: MAX_CART_LINES }, (_, index) => ({
      productId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      planId: `00000000-0000-4000-8000-${String(index + 5001).padStart(12, "0")}`,
      quantity: 1,
    }));
    expect(addCartItem(items, productB, planA)).toBe(items);
  });

  it("updates and removes normalized lines", () => {
    const items = [
      { productId: productA, planId: planA, quantity: 1 },
      { productId: productB, planId: planB, quantity: 2 },
    ];

    expect(updateCartItemQuantity(items, productA.toUpperCase(), planA, 9)).toEqual([
      { productId: productA, planId: planA, quantity: 9 },
      { productId: productB, planId: planB, quantity: 2 },
    ]);

    expect(removeCartItem(items, productB, planB)).toEqual([
      { productId: productA, planId: planA, quantity: 1 },
    ]);
  });

  it("safely rejects invalid updates and removes", () => {
    const items = [{ productId: productA, planId: planA, quantity: 1 }];
    expect(updateCartItemQuantity(items, productA, planA, 100)).toBe(items);
    expect(removeCartItem(items, "bad", planA)).toBe(items);
  });

  it("counts cart quantities", () => {
    expect(
      getCartItemCount([
        { productId: productA, planId: planA, quantity: 2 },
        { productId: productB, planId: planB, quantity: 3 },
      ]),
    ).toBe(5);
  });

  it("merges duplicate cart utility inputs without mutating callers", () => {
    const items = [
      { productId: productA, planId: planA, quantity: 10 },
      { productId: productA, planId: planA, quantity: 5 },
    ];

    const result = mergeCartItems(items);

    expect(result).toEqual([{ productId: productA, planId: planA, quantity: 15 }]);
    expect(items[0].quantity).toBe(10);
    expect(items[1].quantity).toBe(5);
  });
});
