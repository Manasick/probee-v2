"use client";

import { useMemo, useState } from "react";
import { Button, Surface } from "@/components/ui";
import { useCart } from "@/lib/cart/provider";
import { formatDuration, formatPrice } from "@/lib/catalog/format";
import type { ProductPlan } from "@/lib/catalog/types";

interface ProductPlanSelectorProps {
  productId: string;
  plans: ProductPlan[];
  onSelectionChange?: (plan: ProductPlan) => void;
}

function formatBilling(plan: ProductPlan): string | null {
  if (plan.billingType === "subscription") {
    const intervalCount = plan.billingIntervalCount ?? 1;
    const interval = plan.billingInterval ?? "period";
    const pluralInterval =
      intervalCount === 1 ? interval : `${interval}s`;

    return `Billed every ${intervalCount} ${pluralInterval}`;
  }

  if (plan.billingType === "one_time") {
    return "One-time purchase";
  }

  return plan.billingType ?? null;
}

function formatDynamicValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : serialized;
  } catch {
    return null;
  }
}

export function ProductPlanSelector({
  productId,
  plans,
  onSelectionChange,
}: ProductPlanSelectorProps) {
  const { addItem, isHydrated } = useCart();
  const [selectedId, setSelectedId] = useState(plans[0]?.id);
  const [addedPlanId, setAddedPlanId] = useState<string | null>(null);

  const firstPlanId = plans[0]?.id;

  if (plans.length === 0) {
    return (
      <Surface tone="muted" className="p-5">
        <p className="text-sm text-text-muted">
          This product is currently unavailable for purchase because it has no active plans.
        </p>
      </Surface>
    );
  }

  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];

  function selectPlan(plan: ProductPlan) {
    setSelectedId(plan.id);
    setAddedPlanId(null);
    onSelectionChange?.(plan);
  }

  function handleAddToCart() {
    if (!isHydrated) {
      return;
    }

    addItem(productId, selected.id, 1);
    setAddedPlanId(selected.id);
  }

  const selectedAttributes = Object.entries(selected.customAttributes ?? {}).filter(
    ([, value]) => formatDynamicValue(value) !== null,
  );

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="sr-only">Choose a plan</legend>
        <div className="grid gap-3">
          {plans.map((plan) => {
            const active = plan.id === selected.id;
            const duration = formatDuration(plan.duration, plan.durationUnit);
            const billing = formatBilling(plan);
            const warranty = formatDuration(plan.warrantyPeriod, plan.warrantyUnit);

            return (
              <button
                key={plan.id}
                type="button"
                className="probee-focus-ring w-full rounded-[var(--probee-radius-lg)] text-left"
                aria-pressed={active}
                onClick={() => selectPlan(plan)}
              >
                <Surface
                  tone={active ? "interactive" : "default"}
                  className={active ? "border-[var(--probee-gold)]" : ""}
                >
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-base font-semibold">{plan.name}</p>
                        {plan.description ? (
                          <p className="mt-1 text-sm leading-6 text-text-secondary">
                            {plan.description}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-lg font-semibold text-gold">
                        {formatPrice(plan.price, plan.currency)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
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
                      {plan.billingType === "subscription" ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          Renewal {plan.renewalAvailable ? "available" : "not available"}
                        </span>
                      ) : null}
                      {plan.seats != null ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {plan.seats} seat{plan.seats === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {plan.invites != null ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {plan.invites} invite{plan.invites === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {plan.participants != null ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          {plan.participants} participant{plan.participants === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {warranty ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          Warranty: {warranty}
                        </span>
                      ) : null}
                      {plan.requiresCustomerEmail ? (
                        <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                          Customer email required
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Surface>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Surface tone="muted" className="p-5">
        <div className="grid gap-5">
          {selected.deliveryType || selected.deliveryDetails ? (
            <div>
              <p className="probee-label">Delivery</p>
              {selected.deliveryType ? (
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {selected.deliveryType}
                </p>
              ) : null}
              {selected.deliveryDetails ? (
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {selected.deliveryDetails}
                </p>
              ) : null}
            </div>
          ) : null}

          {selected.features?.length ? (
            <div>
              <p className="probee-label">Plan features</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {selected.features.map((feature, index) => (
                  <p
                    key={feature + index}
                    className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-1 px-3 py-2 text-sm text-text-secondary"
                  >
                    {feature}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {selected.customerRequirements?.length ? (
            <div>
              <p className="probee-label">Customer requirements</p>
              <div className="mt-2 grid gap-2">
                {selected.customerRequirements.map((requirement, index) => {
                  const value = formatDynamicValue(requirement);

                  return value ? (
                    <p
                      key={value + index}
                      className="text-sm leading-6 text-text-secondary"
                    >
                      {value}
                    </p>
                  ) : null;
                })}
              </div>
            </div>
          ) : null}

          {selectedAttributes.length ? (
            <div>
              <p className="probee-label">Plan details</p>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {selectedAttributes.map(([key, value]) => {
                  const formattedValue = formatDynamicValue(value);

                  return formattedValue ? (
                    <div
                      key={key}
                      className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-1 px-3 py-2"
                    >
                      <dt className="text-xs text-text-muted">{key}</dt>
                      <dd className="mt-1 text-sm text-text-secondary">
                        {formattedValue}
                      </dd>
                    </div>
                  ) : null;
                })}
              </dl>
            </div>
          ) : null}
        </div>
      </Surface>

      <Button
        size="lg"
        className="w-full sm:w-auto"
        disabled={!isHydrated}
        onClick={handleAddToCart}
      >
        {isHydrated
          ? addedPlanId === selected.id
            ? "Added to cart"
            : "Add to cart"
          : "Preparing cart…"}
      </Button>
    </div>
  );
}
