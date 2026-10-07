"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, LoadingState, Surface } from "@/components/ui";
import { EmptyState } from "@/components/store/empty-state";
import { useCart } from "@/lib/cart/provider";
import { MAX_CART_ITEM_QUANTITY } from "@/lib/cart/storage";
import type { RehydratedCartItem } from "@/lib/cart/types";
import { cartItemKey } from "@/lib/cart/utils";
import { formatDuration, formatPrice } from "@/lib/catalog/format";

interface RehydratePayload {
  items?: RehydratedCartItem[];
  unavailable?: RehydratedCartItem["item"][];
}

function isRehydratedItem(value: unknown): value is RehydratedCartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  const product = item.product;
  const plan = item.plan;

  return (
    typeof item.item === "object" &&
    item.item !== null &&
    typeof product === "object" &&
    product !== null &&
    typeof plan === "object" &&
    plan !== null
  );
}

export function CartView() {
  const { items, itemCount, isHydrated, updateQuantity, removeItem, clearCart } =
    useCart();
  const [catalogItems, setCatalogItems] = useState<RehydratedCartItem[]>([]);
  const [unavailable, setUnavailable] = useState<RehydratedCartItem["item"][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const identitySignature = useMemo(
    () =>
      items
        .map((item) => cartItemKey(item))
        .sort()
        .join("|"),
    [items],
  );

  const hydrationItems = useMemo(() => {
    if (!identitySignature) {
      return [];
    }

    return identitySignature.split("|").map((key) => {
      const [productId, planId] = key.split(":");

      return {
        productId,
        planId,
        quantity: 1,
      };
    });
  }, [identitySignature]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCatalog() {
      if (!hydrationItems.length) {
        setCatalogItems([]);
        setUnavailable([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/cart/rehydrate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items: hydrationItems }),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load the latest catalog data.");
        }

        const payload = (await response.json()) as RehydratePayload;
        const nextItems = Array.isArray(payload.items)
          ? payload.items.filter(isRehydratedItem)
          : [];

        if (!cancelled) {
          setCatalogItems(nextItems);
          setUnavailable(Array.isArray(payload.unavailable) ? payload.unavailable : []);
        }
      } catch {
        if (!cancelled) {
          setCatalogItems([]);
          setUnavailable([]);
          setError("We could not refresh the catalog for your cart. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrateCatalog();

    return () => {
      cancelled = true;
    };
  }, [hydrationItems, retryToken]);

  const currentQuantities = useMemo(
    () => new Map(items.map((item) => [cartItemKey(item), item.quantity])),
    [items],
  );

  const visibleItems = useMemo(
    () =>
      catalogItems
        .map((entry) => {
          const quantity = currentQuantities.get(cartItemKey(entry.item));

          if (!quantity) {
            return null;
          }

          return {
            ...entry,
            item: {
              ...entry.item,
              quantity,
            },
          };
        })
        .filter((entry): entry is RehydratedCartItem => Boolean(entry)),
    [catalogItems, currentQuantities],
  );

  const subtotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const entry of visibleItems) {
      const current = totals.get(entry.plan.currency) ?? 0;
      totals.set(
        entry.plan.currency,
        Math.round((current + entry.plan.price * entry.item.quantity) * 100) / 100,
      );
    }

    return Array.from(totals.entries());
  }, [visibleItems]);

  if (!isHydrated || loading) {
    return (
      <Surface className="p-8">
        <LoadingState label="Refreshing your cart…" />
      </Surface>
    );
  }

  if (error) {
    return (
      <Surface className="p-8">
        <p className="text-lg font-semibold">Cart unavailable</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{error}</p>
        <Button
          className="mt-5"
          onClick={() => setRetryToken((current) => current + 1)}
        >
          Try again
        </Button>
      </Surface>
    );
  }

  if (itemCount === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Choose a product and an active plan to start building your cart."
        action={
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover probee-focus-ring"
          >
            Continue shopping
          </Link>
        }
      />
    );
  }

  function changeQuantity(entry: RehydratedCartItem, delta: number) {
    const nextQuantity = entry.item.quantity + delta;

    if (nextQuantity < 1 || nextQuantity > MAX_CART_ITEM_QUANTITY) {
      return;
    }

    updateQuantity(entry.item.productId, entry.item.planId, nextQuantity);
  }

  function handleManualQuantity(entry: RehydratedCartItem, value: string) {
    const nextQuantity = Number(value);

    if (
      !Number.isInteger(nextQuantity) ||
      nextQuantity < 1 ||
      nextQuantity > MAX_CART_ITEM_QUANTITY
    ) {
      return;
    }

    updateQuantity(entry.item.productId, entry.item.planId, nextQuantity);
  }

  const currencySummary =
    subtotals.length === 1
      ? formatPrice(subtotals[0][1], subtotals[0][0])
      : subtotals.length > 1
        ? "Multiple currencies"
        : "Unavailable";

  return (
    <div className="probee-cart-layout grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-4">
        {unavailable.length ? (
          <Surface tone="muted" className="p-5">
            <p className="text-sm font-semibold text-text-primary">
              Some cart items are no longer available.
            </p>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              A product or plan was unpublished, deactivated, or removed from the live catalog.
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                for (const item of unavailable) {
                  removeItem(item.productId, item.planId);
                }
              }}
            >
              Remove unavailable items
            </Button>
          </Surface>
        ) : null}

        {visibleItems.map((entry) => {
          const duration = formatDuration(entry.plan.duration, entry.plan.durationUnit);
          const lineSubtotal =
            Math.round(entry.plan.price * entry.item.quantity * 100) / 100;

          return (
            <Surface key={cartItemKey(entry.item)} className="probee-cart-item p-4 sm:p-5">
              <div className="flex gap-4">
                <Link
                  href={`/products/${entry.product.slug}`}
                  className="probee-focus-ring relative size-24 shrink-0 overflow-hidden rounded-[var(--probee-radius-md)] bg-surface-2 sm:size-28"
                  aria-label={`View ${entry.product.name}`}
                >
                  {entry.product.coverUrl ? (
                    <Image
                      src={entry.product.coverUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-text-muted">
                      ProBee
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${entry.product.slug}`}
                        className="probee-focus-ring rounded text-base font-semibold hover:text-gold"
                      >
                        {entry.product.name}
                      </Link>
                      <p className="mt-1 text-sm text-text-secondary">{entry.plan.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                        {duration ? (
                          <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                            {duration}
                          </span>
                        ) : null}
                        {entry.plan.billingType === "subscription" ? (
                          <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                            Subscription
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="probee-focus-ring rounded-md px-2 py-1 text-xs font-semibold text-text-muted hover:text-text-primary"
                      onClick={() =>
                        removeItem(entry.item.productId, entry.item.planId)
                      }
                      aria-label={`Remove ${entry.product.name} - ${entry.plan.name}`}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                    <div
                      className="inline-flex items-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2"
                      role="group"
                      aria-label={`Quantity for ${entry.product.name} - ${entry.plan.name}`}
                    >
                      <button
                        type="button"
                        className="probee-focus-ring size-10 rounded-l-[var(--probee-radius-md)] text-lg text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                        onClick={() => changeQuantity(entry, -1)}
                        aria-label={`Decrease quantity for ${entry.product.name}`}
                        disabled={entry.item.quantity <= 1}
                      >
                        −
                      </button>
                      <input
                        aria-label={`Quantity for ${entry.product.name}`}
                        className="h-10 w-14 border-x border-[var(--probee-border-default)] bg-transparent text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                        inputMode="numeric"
                        min={1}
                        max={MAX_CART_ITEM_QUANTITY}
                        step={1}
                        type="number"
                        value={entry.item.quantity}
                        onChange={(event) =>
                          handleManualQuantity(entry, event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="probee-focus-ring size-10 rounded-r-[var(--probee-radius-md)] text-lg text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                        onClick={() => changeQuantity(entry, 1)}
                        aria-label={`Increase quantity for ${entry.product.name}`}
                        disabled={entry.item.quantity >= MAX_CART_ITEM_QUANTITY}
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-text-muted">
                        {formatPrice(entry.plan.price, entry.plan.currency)} each
                      </p>
                      <p className="mt-1 text-base font-semibold text-gold">
                        {formatPrice(lineSubtotal, entry.plan.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Surface>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <Surface className="probee-cart-summary p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div><p className="probee-label">Your selection</p><h2 className="mt-1 text-xl font-semibold">Cart summary</h2></div>
            <span className="text-sm text-text-muted">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-5 border-t border-[var(--probee-border-subtle)] pt-5">
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-right font-semibold text-text-primary">
                {currencySummary}
              </span>
            </div>

            {subtotals.length > 1 ? (
              <div className="mt-3 grid gap-2 text-xs text-text-muted">
                {subtotals.map(([currency, amount]) => (
                  <div
                    key={currency}
                    className="flex items-center justify-between gap-4"
                  >
                    <span>{currency}</span>
                    <span>{formatPrice(amount, currency)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-text-muted">
              Prices and totals shown here come from the current public catalog. Checkout revalidates them again on the server before creating the order.
            </p>

            <div className="mt-7 grid gap-3">
              <Link
                href="/checkout"
                aria-disabled={unavailable.length > 0}
                className={[
                  "inline-flex min-h-12 items-center justify-center rounded-[var(--probee-radius-md)] px-5 text-sm font-semibold probee-focus-ring",
                  unavailable.length
                    ? "pointer-events-none bg-surface-3 text-text-muted"
                    : "bg-gold text-text-inverse hover:bg-gold-hover",
                ].join(" ")}
              >
                Proceed to checkout
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary transition-colors hover:border-[var(--probee-border-strong)] hover:bg-surface-3 probee-focus-ring"
              >
                Continue shopping
              </Link>
              <Button variant="ghost" onClick={clearCart}>
                Clear cart
              </Button>
            </div>
          </div>
        </Surface>
      </aside>
    </div>
  );
}
