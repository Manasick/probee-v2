export type OrderStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled"
  | "failed"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "rejected"
  | "refunded";

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; classes: string }
> = {
  pending: {
    label: "Pending",
    classes: "border-amber-300/20 bg-amber-300/5 text-amber-100",
  },
  processing: {
    label: "Processing",
    classes: "border-sky-300/20 bg-sky-300/5 text-sky-100",
  },
  completed: {
    label: "Completed",
    classes: "border-emerald-300/20 bg-emerald-300/5 text-emerald-100",
  },
  cancelled: {
    label: "Cancelled",
    classes: "border-red-300/20 bg-red-300/5 text-red-100",
  },
  failed: {
    label: "Failed",
    classes: "border-red-300/20 bg-red-300/5 text-red-100",
  },
  refunded: {
    label: "Refunded",
    classes: "border-violet-300/20 bg-violet-300/5 text-violet-100",
  },
};

const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; classes: string }
> = {
  pending: {
    label: "Pending verification",
    classes: "border-amber-300/20 bg-amber-300/5 text-amber-100",
  },
  paid: {
    label: "Paid",
    classes: "border-emerald-300/20 bg-emerald-300/5 text-emerald-100",
  },
  failed: {
    label: "Failed",
    classes: "border-red-300/20 bg-red-300/5 text-red-100",
  },
  rejected: {
    label: "Rejected",
    classes: "border-red-300/20 bg-red-300/5 text-red-100",
  },
  refunded: {
    label: "Refunded",
    classes: "border-violet-300/20 bg-violet-300/5 text-violet-100",
  },
};

export function getOrderStatusMeta(
  value: string,
): { label: string; classes: string } {
  return ORDER_STATUS_META[value as OrderStatus] ?? {
    label: "Pending",
    classes: "border-amber-300/20 bg-amber-300/5 text-amber-100",
  };
}

export function getPaymentStatusMeta(
  value: string,
): { label: string; classes: string } {
  return PAYMENT_STATUS_META[value as PaymentStatus] ?? {
    label: "Pending verification",
    classes: "border-amber-300/20 bg-amber-300/5 text-amber-100",
  };
}

export function getPaymentMethodLabel(value: string | null): string {
  switch (value) {
    case "manual_bank_transfer":
      return "Manual bank transfer";
    case "card":
      return "Card";
    case "mobile_wallet":
      return "Mobile wallet";
    case "crypto":
      return "Crypto";
    case "other":
      return "Other";
    default:
      return "Not selected";
  }
}

export function formatCurrency(
  amount: number | string,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return currency + " " + Number(amount).toFixed(2);
  }
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatFileSize(value: number | null): string {
  if (!value || value <= 0) {
    return "Unknown size";
  }

  const megabytes = value / (1024 * 1024);
  return (
    megabytes.toFixed(megabytes >= 10 ? 0 : 1) +
    " MB"
  );
}

export function isPaymentEligibleOrderStatus(value: string): boolean {
  return !["cancelled", "completed", "refunded"].includes(value);
}
