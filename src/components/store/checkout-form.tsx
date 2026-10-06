"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, LoadingState, Surface } from "@/components/ui";
import { useCart } from "@/lib/cart/provider";
import type { RehydratedCartItem } from "@/lib/cart/types";
import { cartItemKey } from "@/lib/cart/utils";
import { formatDuration, formatPrice } from "@/lib/catalog/format";

interface CheckoutFormProps {
  initialEmail: string;
  initialName: string | null;
  initialPhone: string | null;
  manualBankTransferEnabled: boolean;
}

interface RehydratePayload {
  items?: RehydratedCartItem[];
  unavailable?: RehydratedCartItem["item"][];
}

interface CreatedOrderItem {
  productId: string | null;
  planId: string | null;
  productName: string;
  planName: string | null;
  quantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
}

interface CreatedOrder {
  orderId: string;
  orderReference: string;
  orderStatus: string;
  paymentStatus: string;
  subtotal: number | string;
  total: number | string;
  currency: string;
  createdAt: string;
  items: CreatedOrderItem[];
}

function isCreatedOrder(value: unknown): value is CreatedOrder {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.orderId === "string" &&
    typeof record.orderReference === "string" &&
    typeof record.currency === "string" &&
    Array.isArray(record.items)
  );
}

function formatBilling(plan: RehydratedCartItem["plan"]): string | null {
  if (plan.billingType === "subscription") {
    const intervalCount = plan.billingIntervalCount ?? 1;
    const interval = plan.billingInterval ?? "period";
    return intervalCount === 1
      ? `Billed every ${interval}`
      : `Billed every ${intervalCount} ${interval}s`;
  }

  if (plan.billingType === "one_time") {
    return "One-time purchase";
  }

  return plan.billingType ?? null;
}

export function CheckoutForm({
  initialEmail,
  initialName,
  initialPhone,
  manualBankTransferEnabled,
}: CheckoutFormProps) {
  const router = useRouter();
  const { items, isHydrated, clearCart } = useCart();
  const [catalogItems, setCatalogItems] = useState<RehydratedCartItem[]>([]);
  const [unavailable, setUnavailable] = useState<RehydratedCartItem["item"][]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState(initialName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialPhone ?? "");
  const [successOrder, setSuccessOrder] = useState<CreatedOrder | null>(null);

  const idempotencyKeyRef = useRef<string | null>(null);
  const submissionFingerprintRef = useRef<string | null>(null);

  const cartSignature = useMemo(
    () =>
      items
        .map((item) => `${cartItemKey(item)}=${item.quantity}`)
        .sort()
        .join("|"),
    [items],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!items.length) {
        setCatalogItems([]);
        setUnavailable([]);
        setCatalogError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setCatalogError(null);

      try {
        const response = await fetch("/api/cart/rehydrate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items }),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to refresh the current catalog.");
        }

        const payload = (await response.json()) as RehydratePayload;
        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        const nextUnavailable = Array.isArray(payload.unavailable)
          ? payload.unavailable
          : [];

        if (!cancelled) {
          setCatalogItems(nextItems);
          setUnavailable(nextUnavailable);
        }
      } catch {
        if (!cancelled) {
          setCatalogItems([]);
          setUnavailable([]);
          setCatalogError(
            "We could not refresh the current catalog. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [cartSignature, items]);

  useEffect(() => {
    if (cartSignature !== submissionFingerprintRef.current?.split("::")[0]) {
      idempotencyKeyRef.current = null;
      submissionFingerprintRef.current = null;
    }
  }, [cartSignature]);

  const currentQuantities = useMemo(
    () => new Map(items.map((item) => [cartItemKey(item), item.quantity])),
    [items],
  );

  const visibleItems = useMemo(
    () =>
      catalogItems
        .map((entry) => {
          const quantity = currentQuantities.get(cartItemKey(entry.item));

          return quantity
            ? {
                ...entry,
                item: {
                  ...entry.item,
                  quantity,
                },
              }
            : null;
        })
        .filter((entry): entry is RehydratedCartItem => Boolean(entry)),
    [catalogItems, currentQuantities],
  );

  const subtotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const entry of visibleItems) {
      const amount = Number(entry.plan.price) * entry.item.quantity;
      const current = totals.get(entry.plan.currency) ?? 0;
      totals.set(
        entry.plan.currency,
        Math.round((current + amount) * 100) / 100,
      );
    }

    return Array.from(totals.entries());
  }, [visibleItems]);

  const hasCurrencyMismatch = subtotals.length > 1;
  const catalogReady =
    !loading &&
    !catalogError &&
    items.length > 0 &&
    unavailable.length === 0 &&
    visibleItems.length === items.length &&
    !hasCurrencyMismatch;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!catalogReady || submitting || successOrder) {
      return;
    }

    setSubmitError(null);

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();

    if (trimmedName.length > 200 || trimmedPhone.length > 50) {
      setSubmitError("Please review the customer information and try again.");
      return;
    }

    if (!trimmedName) {
      setSubmitError("Please enter your name before placing the order.");
      return;
    }

    const fingerprint = `${cartSignature}::${trimmedName}::${trimmedPhone}`;

    if (
      !idempotencyKeyRef.current ||
      submissionFingerprintRef.current !== fingerprint
    ) {
      idempotencyKeyRef.current = crypto.randomUUID();
      submissionFingerprintRef.current = fingerprint;
    }

    const idempotencyKey = idempotencyKeyRef.current;

    if (!idempotencyKey) {
      setSubmitError("The checkout request could not be prepared. Please try again.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          items: items.map(({ productId, planId, quantity }) => ({
            productId,
            planId,
            quantity,
          })),
          customerName: trimmedName,
          customerPhone: trimmedPhone || null,
        }),
      });

      if (response.status === 401) {
        router.push("/login?next=%2Fcheckout");
        return;
      }

      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "We could not create your order. No changes were made to your cart.";

        setSubmitError(message);
        return;
      }

      if (!isCreatedOrder(payload)) {
        setSubmitError("Your order was created, but the confirmation response was incomplete. Please contact support before retrying.");
        return;
      }

      clearCart();
      idempotencyKeyRef.current = null;
      submissionFingerprintRef.current = null;
      setSuccessOrder(payload);
    } catch {
      setSubmitError(
        "We could not confirm the checkout request. Your cart was not cleared. Retrying the same submission is safe.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!isHydrated || loading) {
    return (
      <Surface className="p-8">
        <LoadingState label="Preparing secure checkout…" />
      </Surface>
    );
  }

  if (!items.length && !successOrder) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add an active product plan before continuing to checkout."
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

  if (successOrder) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Surface className="p-6 sm:p-8">
          <p className="probee-label">Order created</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Your ProBee order has been created.
          </h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            The order was created successfully. Payment has not been processed in this step.
          </p>

          <div className="mt-6 rounded-[var(--probee-radius-lg)] border border-[var(--probee-border-default)] bg-surface-2 p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
              Order reference
            </p>
            <p className="mt-2 text-xl font-semibold text-gold">
              {successOrder.orderReference}
            </p>
            <p className="mt-3 text-sm text-text-muted">
              Status: {successOrder.orderStatus}
            </p>
          </div>

          {manualBankTransferEnabled && Number(successOrder.total) > 0 ? (
            <div className="mt-6 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 p-4">
              <p className="text-sm font-semibold text-text-primary">
                Next step: manual bank transfer
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Complete the bank transfer and submit your payment reference and proof for verification.
              </p>
              <Link
                href={`/payment?order=${encodeURIComponent(successOrder.orderReference)}`}
                className="probee-focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover sm:w-auto"
              >
                Continue to payment
              </Link>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/account"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover probee-focus-ring"
            >
              Go to account
            </Link>
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary transition-colors hover:border-[var(--probee-border-strong)] hover:bg-surface-3 probee-focus-ring"
            >
              Continue shopping
            </Link>
          </div>
        </Surface>

        <Surface className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <div className="mt-5 space-y-4">
            {successOrder.items.map((item) => (
              <div
                key={`${item.productId ?? "product"}:${item.planId ?? "plan"}`}
                className="border-b border-[var(--probee-border-subtle)] pb-4 last:border-b-0 last:pb-0"
              >
                <p className="font-medium">{item.productName}</p>
                {item.planName ? (
                  <p className="mt-1 text-sm text-text-secondary">{item.planName}</p>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-4 text-sm text-text-muted">
                  <span>Qty {item.quantity}</span>
                  <span>
                    {formatPrice(Number(item.lineTotal), successOrder.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[var(--probee-border-subtle)] pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Total</span>
              <span className="text-lg font-semibold text-gold">
                {formatPrice(Number(successOrder.total), successOrder.currency)}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-text-muted">
              This order is awaiting the payment stage that will be added later.
            </p>
          </div>
        </Surface>
      </div>
    );
  }

  if (catalogError) {
    return (
      <Surface className="p-8">
        <p className="text-lg font-semibold">Checkout data unavailable</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{catalogError}</p>
        <div className="mt-5">
          <Link
            href="/cart"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover probee-focus-ring"
          >
            Review cart
          </Link>
        </div>
      </Surface>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Surface className="p-6 sm:p-8">
          <div>
            <p className="probee-label">Customer information</p>
            <h2 className="mt-2 text-xl font-semibold">Who should receive this order?</h2>
          </div>

          <div className="mt-6 grid gap-5">
            <div>
              <label
                htmlFor="checkout-email"
                className="text-sm font-medium text-text-secondary"
              >
                Account email
              </label>
              <input
                id="checkout-email"
                type="email"
                value={initialEmail}
                readOnly
                className="mt-2 min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-muted outline-none"
              />
              <p className="mt-2 text-xs leading-5 text-text-muted">
                This email comes from your authenticated ProBee account.
              </p>
            </div>

            <div>
              <label
                htmlFor="checkout-name"
                className="text-sm font-medium text-text-secondary"
              >
                Full name
              </label>
              <input
                id="checkout-name"
                type="text"
                autoComplete="name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                maxLength={200}
                required
                className="mt-2 min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                placeholder="Your name"
              />
            </div>

            <div>
              <label
                htmlFor="checkout-phone"
                className="text-sm font-medium text-text-secondary"
              >
                Phone
              </label>
              <input
                id="checkout-phone"
                type="tel"
                autoComplete="tel"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                maxLength={50}
                className="mt-2 min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                placeholder="Optional"
              />
            </div>
          </div>
        </Surface>

        <Surface className="p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="probee-label">Order review</p>
              <h2 className="mt-2 text-xl font-semibold">Selected plans</h2>
            </div>
            <Link
              href="/cart"
              className="probee-focus-ring rounded text-sm font-semibold text-gold hover:text-gold-hover"
            >
              Edit cart
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {visibleItems.map((entry) => {
              const duration = formatDuration(
                entry.plan.duration,
                entry.plan.durationUnit,
              );
              const billing = formatBilling(entry.plan);
              const unitPrice = Number(entry.plan.price);
              const lineTotal =
                Math.round(unitPrice * entry.item.quantity * 100) / 100;

              return (
                <div
                  key={cartItemKey(entry.item)}
                  className="flex gap-4 rounded-[var(--probee-radius-lg)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-[var(--probee-radius-md)] bg-surface-3 sm:size-24">
                    {entry.product.coverUrl ? (
                      <Image
                        src={entry.product.coverUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-text-muted">
                        ProBee
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{entry.product.name}</p>
                    <p className="mt-1 text-sm text-text-secondary">{entry.plan.name}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                      {duration ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {duration}
                        </span>
                      ) : null}
                      {billing ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {billing}
                        </span>
                      ) : null}
                      {entry.plan.seats != null ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {entry.plan.seats} seat{entry.plan.seats === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {entry.plan.invites != null ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {entry.plan.invites} invite{entry.plan.invites === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {entry.plan.participants != null ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {entry.plan.participants} participant{entry.plan.participants === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 text-sm">
                      <span className="text-text-muted">
                        {formatPrice(unitPrice, entry.plan.currency)} × {entry.item.quantity}
                      </span>
                      <span className="font-semibold text-gold">
                        {formatPrice(lineTotal, entry.plan.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Surface>
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <Surface className="p-6 sm:p-8">
          <p className="probee-label">Secure checkout</p>
          <h2 className="mt-2 text-xl font-semibold">Order total</h2>

          {unavailable.length ? (
            <div
              className="mt-5 rounded-[var(--probee-radius-md)] border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100"
              role="alert"
            >
              Some cart items are no longer available. Review your cart before placing the order.
            </div>
          ) : null}

          {hasCurrencyMismatch ? (
            <div
              className="mt-5 rounded-[var(--probee-radius-md)] border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100"
              role="alert"
            >
              Your cart contains multiple currencies. Please separate them into different orders.
            </div>
          ) : null}

          {submitError ? (
            <div
              className="mt-5 rounded-[var(--probee-radius-md)] border border-red-300/20 bg-red-300/5 p-4 text-sm leading-6 text-red-100"
              role="alert"
              aria-live="polite"
            >
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 border-y border-[var(--probee-border-subtle)] py-5">
            {subtotals.map(([currency, amount]) => (
              <div
                key={currency}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-text-muted">Subtotal</span>
                <span className="font-semibold text-text-primary">
                  {formatPrice(amount, currency)}
                </span>
              </div>
            ))}
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-semibold text-gold">
                {subtotals.length === 1
                  ? formatPrice(subtotals[0][1], subtotals[0][0])
                  : "—"}
              </span>
            </div>
          </div>

          <p className="mt-5 text-xs leading-5 text-text-muted">
            Final prices and totals are recalculated on the server from the current product catalog when you place the order.
          </p>

          <Button
            size="lg"
            type="submit"
            className="mt-6 w-full"
            disabled={!catalogReady || submitting}
          >
            {submitting ? "Placing order…" : "Place order"}
          </Button>

          <p className="mt-3 text-center text-xs leading-5 text-text-muted">
            Payment is not processed during this step.
          </p>
        </Surface>
      </aside>
    </form>
  );
}
