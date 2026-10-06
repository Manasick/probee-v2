"use client";

import Link from "next/link";
import { EmptyState } from "@/components/store/empty-state";
import { LoadingState, Surface } from "@/components/ui";
import { useCart } from "@/lib/cart/provider";

export function CheckoutCartStatus() {
  const { itemCount, isHydrated } = useCart();

  if (!isHydrated) {
    return (
      <Surface className="p-6">
        <LoadingState label="Loading your cart…" />
      </Surface>
    );
  }

  if (itemCount === 0) {
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

  return (
    <Surface className="p-6">
      <h2 className="text-lg font-semibold">Cart ready</h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        {itemCount} item{itemCount === 1 ? "" : "s"} are ready for secure checkout review.
      </p>
      <p className="mt-3 text-xs leading-5 text-text-muted">
        Order creation uses the current server-side catalog pricing. Payment is handled separately after the order is created.
      </p>
      <div className="mt-5">
        <Link
          href="/cart"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary transition-colors hover:border-[var(--probee-border-strong)] hover:bg-surface-3 probee-focus-ring"
        >
          Review cart
        </Link>
      </div>
    </Surface>
  );
}
