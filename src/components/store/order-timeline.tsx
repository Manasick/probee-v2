import { formatDate } from "@/lib/orders/presentation";

type TimelineState = "complete" | "current" | "upcoming";

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  state: TimelineState;
  timestamp?: string | null;
}

interface OrderTimelineProps {
  orderStatus: string;
  paymentStatus: string;
  orderCreatedAt: string;
  paymentCreatedAt?: string | null;
  paymentVerifiedAt?: string | null;
  paymentReference?: string | null;
}

function getPaymentStep(
  paymentStatus: string,
  paymentCreatedAt?: string | null,
  paymentVerifiedAt?: string | null,
): TimelineStep {
  if (paymentStatus === "paid") {
    return {
      key: "payment",
      label: "Payment verified",
      description: "The payment is recorded as paid.",
      state: "complete",
      timestamp: paymentVerifiedAt ?? null,
    };
  }

  if (paymentStatus === "rejected") {
    return {
      key: "payment",
      label: "Payment needs attention",
      description: "The previous payment submission was rejected and can be resubmitted while the order remains eligible.",
      state: "current",
      timestamp: paymentCreatedAt ?? null,
    };
  }

  if (paymentStatus === "failed") {
    return {
      key: "payment",
      label: "Payment failed",
      description: "The recorded payment attempt did not complete.",
      state: "current",
      timestamp: paymentCreatedAt ?? null,
    };
  }

  return {
    key: "payment",
    label: "Payment verification",
    description: "The order is waiting for its payment stage to be completed.",
    state: "current",
    timestamp: paymentCreatedAt ?? null,
  };
}

export function OrderTimeline({
  orderStatus,
  paymentStatus,
  orderCreatedAt,
  paymentCreatedAt,
  paymentVerifiedAt,
  paymentReference,
}: OrderTimelineProps) {
  const paymentStep = getPaymentStep(
    paymentStatus,
    paymentCreatedAt,
    paymentVerifiedAt,
  );

  const steps: TimelineStep[] = [
    {
      key: "placed",
      label: "Order placed",
      description: "Your order was created successfully.",
      state: "complete",
      timestamp: orderCreatedAt,
    },
    paymentStep,
    {
      key: "processing",
      label: "Processing",
      description:
        orderStatus === "processing"
          ? "Your order is currently being processed."
          : orderStatus === "completed"
            ? "The order reached processing before completion."
            : "This step has not been marked as active.",
      state:
        orderStatus === "processing"
          ? "current"
          : orderStatus === "completed"
            ? "complete"
            : "upcoming",
    },
    {
      key: "completed",
      label: "Completed",
      description:
        orderStatus === "completed"
          ? "The order is marked completed."
          : "This step is not yet complete.",
      state: orderStatus === "completed" ? "current" : "upcoming",
    },
  ];

  const terminalStatus =
    orderStatus === "cancelled" ||
    orderStatus === "failed" ||
    orderStatus === "refunded";

  if (terminalStatus) {
    const label =
      orderStatus === "cancelled"
        ? "Cancelled"
        : orderStatus === "failed"
          ? "Failed"
          : "Refunded";

    steps.push({
      key: "terminal",
      label,
      description:
        orderStatus === "cancelled"
          ? "This order is no longer active."
          : orderStatus === "failed"
            ? "This order is marked as failed."
            : "This order is marked as refunded.",
      state: "current",
    });
  }

  return (
    <div className="mt-6">
      <ol className="relative grid gap-0">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex gap-4 pb-7 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[0.6875rem] top-6 h-[calc(100%-0.5rem)] w-px bg-[var(--probee-border-default)]"
              />
            ) : null}

            <span
              aria-hidden="true"
              className={[
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.625rem] font-bold",
                step.state === "complete"
                  ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                  : step.state === "current"
                    ? "border-gold/50 bg-gold-soft text-gold"
                    : "border-[var(--probee-border-default)] bg-surface-2 text-text-muted",
              ].join(" ")}
            >
              {step.state === "complete" ? "✓" : index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {step.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-text-muted">
                    {step.description}
                  </p>
                </div>
                {step.timestamp ? (
                  <time
                    dateTime={step.timestamp}
                    className="shrink-0 text-xs text-text-muted"
                  >
                    {formatDate(step.timestamp)}
                  </time>
                ) : null}
              </div>

              {step.key === "payment" && paymentReference ? (
                <p className="mt-2 text-xs text-text-muted">
                  Payment reference: <span className="text-text-secondary">{paymentReference}</span>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-5 text-xs leading-5 text-text-muted">
        This timeline reflects the current database status. Historical order-status transition times are not stored yet, so no synthetic timestamps are shown.
      </p>
    </div>
  );
}
