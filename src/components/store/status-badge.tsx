import {
  getOrderStatusMeta,
  getPaymentStatusMeta,
} from "@/lib/orders/presentation";

interface StatusBadgeProps {
  kind: "order" | "payment";
  status: string;
}

export function StatusBadge({ kind, status }: StatusBadgeProps) {
  const meta =
    kind === "order"
      ? getOrderStatusMeta(status)
      : getPaymentStatusMeta(status);

  return (
    <span
      className={[
        "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
        meta.classes,
      ].join(" ")}
    >
      {meta.label}
    </span>
  );
}
