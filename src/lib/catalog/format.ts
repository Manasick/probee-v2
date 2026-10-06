import type { CatalogProduct, ProductPlan } from "./types";

export function formatPrice(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDuration(
  duration?: number,
  unit?: string,
): string | null {
  if (!duration || !unit) {
    return null;
  }

  const label = duration === 1 ? unit.replace(/s$/, "") : unit;
  return `${duration} ${label}`;
}

export function getPlanPriceRange(
  plans: ProductPlan[],
): { min: number; max: number; currency: string } | null {
  const activePlans = plans.filter(
    (plan) =>
      Number.isFinite(plan.price) &&
      plan.price >= 0 &&
      Boolean(plan.currency),
  );

  if (activePlans.length === 0) {
    return null;
  }

  const amounts = activePlans.map((plan) => plan.price);
  const currency =
    activePlans.every((plan) => plan.currency === activePlans[0].currency)
      ? activePlans[0].currency
      : "";

  return {
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    currency,
  };
}

export function formatProductPrice(product: CatalogProduct): string | null {
  const range = getPlanPriceRange(product.plans);

  if (!range) {
    return null;
  }

  if (!range.currency) {
    return "Multiple currencies";
  }

  if (range.min === range.max) {
    return formatPrice(range.min, range.currency);
  }

  return `${formatPrice(range.min, range.currency)} – ${formatPrice(
    range.max,
    range.currency,
  )}`;
}
