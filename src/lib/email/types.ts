export const TRANSACTIONAL_EMAIL_EVENTS = [
  "account_activation",
  "password_reset",
  "order_created",
  "payment_submitted",
  "payment_paid",
  "payment_rejected",
  "digital_entitlement_ready",
] as const;

export type TransactionalEmailEvent = (typeof TRANSACTIONAL_EMAIL_EVENTS)[number];

export type TransactionalEmailRequest =
  | { event: "order_created"; orderId: string }
  | { event: "payment_submitted"; paymentId: string }
  | { event: "payment_paid"; paymentId: string }
  | { event: "payment_rejected"; paymentId: string }
  | { event: "digital_entitlement_ready"; entitlementId: string };

export type EmailDeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed";

export interface RenderedTransactionalEmail {
  subject: string;
  html: string;
  preheader?: string;
}
