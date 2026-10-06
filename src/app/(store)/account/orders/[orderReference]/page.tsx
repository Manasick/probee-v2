import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { AccountNav } from "@/components/store/account-nav";
import { OrderTimeline } from "@/components/store/order-timeline";
import { StatusBadge } from "@/components/store/status-badge";
import { requireAuthenticated } from "@/lib/auth/server";
import {
  formatCurrency,
  formatDate,
  formatFileSize,
  getPaymentMethodLabel,
  isPaymentEligibleOrderStatus,
} from "@/lib/orders/presentation";
import { getMyReviewDashboard } from "@/lib/reviews/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  order_reference: string;
  order_status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  currency: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  product_id: string | null;
  product_name_snapshot: string;
  plan_name_snapshot: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  created_at: string;
}

interface PaymentRow {
  id: string;
  payment_method: string;
  payment_status: string;
  amount: number | string;
  currency: string;
  external_reference: string | null;
  verified_at: string | null;
  created_at: string;
}

interface ProofRow {
  id: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  verification_status: string;
  created_at: string;
}

export default async function AccountOrderDetailsPage({
  params,
}: {
  params: Promise<{ orderReference: string }>;
}) {
  const context = await requireAuthenticated("/account/orders");
  const { orderReference: rawReference } = await params;
  const orderReference = rawReference.trim();

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id,order_reference,order_status,payment_status,payment_method,subtotal,discount,total,currency,customer_email,customer_phone,customer_name,created_at,updated_at",
    )
    .eq("user_id", context.user.id)
    .eq("order_reference", orderReference)
    .maybeSingle();

  if (orderError || !order) {
    return (
      <section className="probee-section">
        <Container>
          <div className="max-w-3xl">
            <p className="probee-label">Order</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Order not available
            </h1>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              This order could not be found in your account.
            </p>
          </div>

          <div className="mt-8">
            <AccountNav />
          </div>
        </Container>
      </section>
    );
  }

  const [{ data: items, error: itemsError }, { data: payments, error: paymentsError }, reviewDashboard] =
    await Promise.all([
      supabase
        .from("order_items")
        .select(
          "id,product_id,product_name_snapshot,plan_name_snapshot,quantity,unit_price,line_total,created_at",
        )
        .eq("order_id", order.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("payments")
        .select(
          "id,payment_method,payment_status,amount,currency,external_reference,verified_at,created_at",
        )
        .eq("order_id", order.id)
        .order("created_at", { ascending: false }),
      getMyReviewDashboard(),
    ]);

  const orderItems = (items ?? []) as OrderItemRow[];
  const paymentRows = (payments ?? []) as PaymentRow[];
  const latestPayment = paymentRows[0] ?? null;
  const reviewsByProduct = new Map(
    reviewDashboard.reviews.map((review) => [review.productId, review]),
  );
  const orderReviewEligible =
    order.payment_status === "paid" &&
    !["cancelled", "failed", "refunded"].includes(order.order_status);

  let latestProof: ProofRow | null = null;

  if (latestPayment) {
    const { data: proof } = await supabase
      .from("payment_proofs")
      .select(
        "id,original_filename,mime_type,file_size_bytes,verification_status,created_at",
      )
      .eq("payment_id", latestPayment.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestProof = (proof as ProofRow | null) ?? null;
  }

  const paymentEligible =
    Number(order.total) > 0 &&
    isPaymentEligibleOrderStatus(order.order_status) &&
    order.payment_status !== "paid" &&
    (order.payment_method === null ||
      order.payment_method === "manual_bank_transfer") &&
    (latestPayment === null ||
      latestPayment.payment_method === "manual_bank_transfer");

  const paymentActionLabel =
    latestPayment?.payment_status === "rejected"
      ? "Resubmit payment proof"
      : "Continue payment";

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <Link
            href="/account/orders"
            className="probee-focus-ring inline-flex rounded text-sm font-semibold text-gold hover:text-gold-hover"
          >
            ← Back to orders
          </Link>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="probee-label">Order details</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
                {order.order_reference}
              </h1>
              <p className="mt-3 text-sm text-text-muted">
                Placed {formatDate(order.created_at)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge kind="order" status={order.order_status} />
              <StatusBadge kind="payment" status={order.payment_status} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <AccountNav />
        </div>

        {itemsError || paymentsError ? (
          <Surface className="mt-8 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="text-sm font-semibold text-red-100">
              Some order details could not be loaded.
            </p>
            <p className="mt-2 text-sm leading-6 text-red-100/70">
              Please refresh the page or try again later.
            </p>
          </Surface>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-6">
            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Tracking</p>
              <h2 className="mt-2 text-xl font-semibold">Order progress</h2>

              <OrderTimeline
                orderStatus={order.order_status}
                paymentStatus={order.payment_status}
                orderCreatedAt={order.created_at}
                paymentCreatedAt={latestPayment?.created_at ?? null}
                paymentVerifiedAt={latestPayment?.verified_at ?? null}
                paymentReference={latestPayment?.external_reference ?? null}
              />
            </Surface>

            <Surface className="p-6 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="probee-label">Purchased items</p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {orderItems.length} {orderItems.length === 1 ? "line" : "lines"}
                  </h2>
                </div>
                <p className="text-sm text-text-muted">
                  Order total: <span className="font-semibold text-text-primary">{formatCurrency(order.total, order.currency)}</span>
                </p>
              </div>

              <div className="mt-6 grid gap-3">
                {orderItems.length > 0 ? (
                  orderItems.map((item) => {
                    const existingReview = item.product_id
                      ? reviewsByProduct.get(item.product_id)
                      : undefined;

                    return (
                      <div
                        key={item.id}
                        className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-text-primary">
                              {item.product_name_snapshot}
                            </p>
                            {item.plan_name_snapshot ? (
                              <p className="mt-1 text-sm text-text-secondary">
                                {item.plan_name_snapshot}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs text-text-muted">
                              Quantity {item.quantity} · Unit price {formatCurrency(item.unit_price, order.currency)}
                            </p>
                          </div>

                          <p className="shrink-0 text-lg font-semibold text-gold">
                            {formatCurrency(item.line_total, order.currency)}
                          </p>
                        </div>

                        {orderReviewEligible && item.product_id ? (
                          <div className="mt-4 border-t border-[var(--probee-border-subtle)] pt-4">
                            <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
                              Review
                            </p>
                            {existingReview ? (
                              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold">
                                    {existingReview.status === "approved"
                                      ? "Review published"
                                      : existingReview.status === "pending"
                                        ? "Review pending moderation"
                                        : existingReview.status === "rejected"
                                          ? "Review needs changes"
                                          : "Review hidden"}
                                  </p>
                                  <p className="mt-1 text-xs text-text-muted">
                                    Rating {existingReview.rating}/5
                                  </p>
                                </div>
                                <Link
                                  href={"/account/reviews?edit=" + encodeURIComponent(existingReview.id)}
                                  className="probee-focus-ring inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-3 px-4 text-sm font-semibold text-text-secondary hover:text-text-primary"
                                >
                                  Edit review
                                </Link>
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-text-secondary">
                                  Your payment is confirmed. You can now review this product.
                                </p>
                                <Link
                                  href={"/account/reviews?product=" + encodeURIComponent(item.product_id)}
                                  className="probee-focus-ring inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                                >
                                  Write a review
                                </Link>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-text-muted">
                    No order items are available to display.
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-[var(--probee-border-subtle)] pt-5">
                <dl className="grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted">Subtotal</dt>
                    <dd className="font-medium">{formatCurrency(order.subtotal, order.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted">Discount</dt>
                    <dd className="font-medium">{formatCurrency(order.discount, order.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[var(--probee-border-subtle)] pt-3">
                    <dt className="font-semibold">Total</dt>
                    <dd className="text-lg font-semibold text-gold">
                      {formatCurrency(order.total, order.currency)}
                    </dd>
                  </div>
                </dl>
              </div>
            </Surface>

            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Customer information</p>
              <h2 className="mt-2 text-xl font-semibold">Order contact details</h2>

              <dl className="mt-6 grid gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                    Name
                  </dt>
                  <dd className="mt-1 text-text-secondary">
                    {order.customer_name || "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                    Email
                  </dt>
                  <dd className="mt-1 break-words text-text-secondary">
                    {order.customer_email || context.user.email || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                    Phone
                  </dt>
                  <dd className="mt-1 text-text-secondary">
                    {order.customer_phone || "Not provided"}
                  </dd>
                </div>
              </dl>
            </Surface>
          </div>

          <div className="grid gap-6">
            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Payment</p>
              <h2 className="mt-2 text-xl font-semibold">Payment status</h2>

              <div className="mt-5 flex flex-wrap gap-2">
                <StatusBadge kind="payment" status={order.payment_status} />
                <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--probee-border-default)] bg-surface-2 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  {getPaymentMethodLabel(order.payment_method ?? latestPayment?.payment_method ?? null)}
                </span>
              </div>

              <dl className="mt-6 grid gap-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-muted">Amount</dt>
                  <dd className="font-semibold text-text-primary">
                    {formatCurrency(order.total, order.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-muted">Currency</dt>
                  <dd className="font-medium">{order.currency}</dd>
                </div>
                {latestPayment?.external_reference ? (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                      Payment reference
                    </dt>
                    <dd className="mt-1 break-words text-text-secondary">
                      {latestPayment.external_reference}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {paymentEligible ? (
                <div className="mt-6 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 p-4">
                  <p className="text-sm font-semibold">
                    {latestPayment?.payment_status === "rejected"
                      ? "Payment action needed"
                      : "Manual payment available"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {latestPayment?.payment_status === "rejected"
                      ? "Return to the payment page to submit a new proof for this order."
                      : "Open the secure manual-payment flow to view bank instructions or submit your proof."}
                  </p>
                  <Link
                    href={"/payment?order=" + encodeURIComponent(order.order_reference)}
                    className="probee-focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                  >
                    {paymentActionLabel}
                  </Link>
                </div>
              ) : null}
            </Surface>

            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Payment proof</p>
              <h2 className="mt-2 text-xl font-semibold">Submission record</h2>

              {latestProof ? (
                <dl className="mt-5 grid gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                      File
                    </dt>
                    <dd className="mt-1 break-words text-text-secondary">
                      {latestProof.original_filename || "Uploaded proof"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted">Size</dt>
                    <dd className="font-medium">{formatFileSize(latestProof.file_size_bytes)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted">Submitted</dt>
                    <dd className="text-right font-medium">
                      {formatDate(latestProof.created_at)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted">Verification</dt>
                    <dd className="font-medium capitalize">
                      {latestProof.verification_status}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-5 text-sm leading-6 text-text-muted">
                  No payment proof has been submitted for the latest payment record.
                </p>
              )}

              <p className="mt-5 text-xs leading-5 text-text-muted">
                Payment-proof storage paths and public storage URLs are never shown in the customer account.
              </p>
            </Surface>

            <Surface id="security" className="scroll-mt-24 p-6 sm:p-8">
              <p className="probee-label">Security</p>
              <h2 className="mt-2 text-xl font-semibold">Password and account security</h2>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Password changes use the existing Supabase Auth recovery flow. ProBee does not write passwords into the customer profile table.
              </p>
              <Link
                href="/forgot-password"
                className="probee-focus-ring mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary hover:bg-surface-3"
              >
                Open password recovery
              </Link>
            </Surface>

            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Digital access</p>
              <h2 className="mt-2 text-xl font-semibold">Fulfillment</h2>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Fulfilled digital access, customer-safe instructions, and private file delivery are available in your digital products area.
              </p>
              <Link
                href="/account/digital-products"
                className="probee-focus-ring mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
              >
                Open digital products
              </Link>
            </Surface>
          </div>
        </div>
      </Container>
    </section>
  );
}
