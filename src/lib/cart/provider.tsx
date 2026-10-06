"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "./types";
import {
  MAX_CART_ITEM_QUANTITY,
  readStoredCart,
  writeStoredCart,
  parseStoredCart,
} from "./storage";
import {
  addCartItem,
  getCartItemCount,
  removeCartItem,
  updateCartItemQuantity,
} from "./utils";

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  isHydrated: boolean;
  addItem: (productId: string, planId: string, quantity?: number) => void;
  removeItem: (productId: string, planId: string) => void;
  updateQuantity: (productId: string, planId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setIsHydrated(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "probee-cart-v1") {
        setItems(parseStoredCart(event.newValue));
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      writeStoredCart(items);
    }
  }, [items, isHydrated]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: getCartItemCount(items),
      isHydrated,
      addItem: (productId, planId, quantity = 1) => {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_ITEM_QUANTITY) {
          return;
        }

        setItems((current) => addCartItem(current, productId, planId, quantity));
      },
      removeItem: (productId, planId) => {
        setItems((current) => removeCartItem(current, productId, planId));
      },
      updateQuantity: (productId, planId, quantity) => {
        setItems((current) =>
          updateCartItemQuantity(current, productId, planId, quantity),
        );
      },
      clearCart: () => {
        setItems([]);
      },
    }),
    [items, isHydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
