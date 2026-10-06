"use client";

import { useState } from "react";
import { Button, Surface } from "@/components/ui";
import { formatDuration, formatPrice } from "@/lib/catalog/format";
import type { ProductPlan } from "@/lib/catalog/types";

interface ProductPlanSelectorProps {
  plans: ProductPlan[];
  onSelectionChange?: (plan: ProductPlan) => void;
}

export function ProductPlanSelector({
  plans,
  onSelectionChange,
}: ProductPlanSelectorProps) {
  const [selectedId, setSelectedId] = useState(plans[0]?.id);

  if (plans.length === 0) {
    return (
      <Surface tone="muted" className="p-5">
        <p className="text-sm text-text-muted">
          Plan options will be displayed here when this product is configured.
        </p>
      </Surface>
    );
  }

  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];

  function selectPlan(plan: ProductPlan) {
    setSelectedId(plan.id);
    onSelectionChange?.(plan);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {plans.map((plan) => {
          const active = plan.id === selected.id;
          const duration = formatDuration(plan.duration, plan.durationUnit);

          return (
            <button
              key={plan.id}
              type="button"
              className="probee-focus-ring rounded-[var(--radius-lg)] text-left"
              aria-pressed={active}
              onClick={() => selectPlan(plan)}
            >
              <Surface
                tone={active ? "interactive" : "default"}
                className={`p-5 ${active ? "border-[var(--probee-gold)]" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold">{plan.name}</p>
                    {duration ? (
                      <p className="mt-1 text-sm text-text-muted">{duration}</p>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold text-gold">
                    {formatPrice(plan.price, plan.currency)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
                  {plan.renewalAvailable ? (
                    <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                      Renewal available
                    </span>
                  ) : null}
                  {plan.seats ? (
                    <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                      {plan.seats} seat{plan.seats === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {plan.invites ? (
                    <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                      {plan.invites} invite{plan.invites === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {plan.participants ? (
                    <span className="rounded-full border border-[var(--probee-border-subtle)] px-2.5 py-1">
                      {plan.participants} participant{plan.participants === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </Surface>
            </button>
          );
        })}
      </div>

      <Button size="lg" className="w-full sm:w-auto" disabled>
        Purchase will be enabled later
      </Button>

      {selected.features?.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {selected.features.map((feature) => (
            <p
              key={feature}
              className="rounded-[var(--radius-md)] border border-[var(--probee-border-subtle)] bg-surface-1 px-3 py-2 text-sm text-text-secondary"
            >
              {feature}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
