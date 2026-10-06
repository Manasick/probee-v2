import Link from "next/link";
import { AdminErrorState } from "@/components/admin/admin-error-state";
import { AdminStatus } from "@/components/admin/admin-status";
import { Container, Surface } from "@/components/ui";
import { getAdminDashboardData } from "@/lib/admin/dashboard";

function money(
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
    return currency + " " + amount.toFixed(2);
  }
}

function date(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "paid" || status === "completed" || status === "active" || status === "approved") return "success";
  if (status === "pending" || status === "processing" || status === "sending") return "warning";
  if (status === "rejected" || status === "failed" || status === "cancelled" || status === "revoked") return "danger";
  return "info";
}

export default async function AdminDashboardPage() {
  try {
    const { stats, recentOrders, recentPayments, pendingReviews, recentFulfillments } =
      await getAdminDashboardData();

    const salesEntries = Object.entries(stats.totalPaidSalesByCurrency);

    const cards = [
      ["Total orders", stats.totalOrders],
      ["Pending orders", stats.pendingOrders],
      ["Processing orders", stats.processingOrders],
      ["Completed orders", stats.completedOrders],
      ["Cancelled orders", stats.cancelledOrders],
      ["Failed orders", stats.failedOrders],
      ["Pending payments", stats.pendingPayments],
      ["Paid payments", stats.paidPayments],
      ["Rejected payments", stats.rejectedPayments],
      ["Customers", stats.totalCustomers],
      ["Active products", stats.activeProducts],
      ["Published products", stats.publishedProducts],
      ["Pending reviews", stats.pendingReviews],
      ["Active digital entitlements", stats.activeDigitalEntitlements],
    ] as const;

    return (
      <section className="probee-section">
        <Container>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="probee-label">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
                ProBee operations overview
              </h1>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                Live database-derived operational metrics. Payment state remains independent from order state.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/orders" className="probee-focus-ring inline-flex min-h-11 items-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse">
                View orders
              </Link>
              <Link href="/admin/payments?status=pending" className="probee-focus-ring inline-flex min-h-11 items-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold">
                Review payments
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value]) => (
              <Surface key={label} className="p-5">
                <p className="text-xs uppercase tracking-[0.1em] text-text-muted">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
              </Surface>
            ))}
          </div>

          <Surface className="mt-5 p-5 sm:p-6">
            <p className="probee-label">Paid sales</p>
            <h2 className="mt-2 text-xl font-semibold">Authoritative paid order totals</h2>
            <p className="mt-2 text-sm text-text-muted">
              Sales are kept separate by currency; no cross-currency arithmetic is performed.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {salesEntries.length ? salesEntries.map(([currency, amount]) => (
                <div key={currency} className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">{currency}</p>
                  <p className="mt-2 text-2xl font-semibold text-gold">{money(amount, currency)}</p>
                </div>
              )) : (
                <p className="text-sm text-text-muted">No paid sales yet.</p>
              )}
            </div>
          </Surface>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Surface className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="probee-label">Recent orders</p>
                  <h2 className="mt-2 text-xl font-semibold">Latest activity</h2>
                </div>
                <Link href="/admin/orders" className="probee-focus-ring text-sm font-semibold text-gold">All orders</Link>
              </div>
              <div className="mt-5 grid gap-3">
                {recentOrders.length ? recentOrders.map((order) => (
                  <Link key={order.id} href={"/admin/orders/" + order.id} className="probee-focus-ring rounded-xl border border-[var(--probee-border-subtle)] bg-surface-2 p-4 hover:bg-surface-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{order.orderReference}</p>
                        <p className="mt-1 text-sm text-text-muted">{order.customerName || order.customerEmail || "Customer"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AdminStatus label={order.orderStatus} tone={statusTone(order.orderStatus)} />
                        <AdminStatus label={order.paymentStatus} tone={statusTone(order.paymentStatus)} />
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gold">{money(Number(order.total), order.currency)}</p>
                    <p className="mt-1 text-xs text-text-muted">{date(order.createdAt)}</p>
                  </Link>
                )) : <p className="text-sm text-text-muted">No orders yet.</p>}
              </div>
            </Surface>

            <Surface className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="probee-label">Recent payments</p>
                  <h2 className="mt-2 text-xl font-semibold">Manual transfer activity</h2>
                </div>
                <Link href="/admin/payments" className="probee-focus-ring text-sm font-semibold text-gold">All payments</Link>
              </div>
              <div className="mt-5 grid gap-3">
                {recentPayments.length ? recentPayments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{payment.orderReference}</p>
                        <p className="mt-1 text-sm text-text-muted">{payment.customerName || "Customer"}</p>
                      </div>
                      <AdminStatus label={payment.status} tone={statusTone(payment.status)} />
                    </div>
                    <p className="mt-3 text-sm text-gold">{money(Number(payment.amount), payment.currency)}</p>
                    <p className="mt-1 text-xs text-text-muted">{date(payment.createdAt)}</p>
                  </div>
                )) : <p className="text-sm text-text-muted">No payments yet.</p>}
              </div>
            </Surface>

            <Surface className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="probee-label">Pending reviews</p>
                  <h2 className="mt-2 text-xl font-semibold">Moderation queue</h2>
                </div>
                <Link href="/admin/reviews" className="probee-focus-ring text-sm font-semibold text-gold">Moderate</Link>
              </div>
              <div className="mt-5 grid gap-3">
                {pendingReviews.length ? pendingReviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{review.productName}</p>
                      <AdminStatus label="pending" tone="warning" />
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{review.reviewerName} · {"★".repeat(review.rating)}</p>
                    <p className="mt-3 text-sm text-text-secondary">{review.title || review.body.slice(0, 120)}</p>
                  </div>
                )) : <p className="text-sm text-text-muted">No pending reviews.</p>}
              </div>
            </Surface>

            <Surface className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="probee-label">Recent fulfillment</p>
                  <h2 className="mt-2 text-xl font-semibold">Digital delivery</h2>
                </div>
                <Link href="/admin/digital-delivery" className="probee-focus-ring text-sm font-semibold text-gold">Open queue</Link>
              </div>
              <div className="mt-5 grid gap-3">
                {recentFulfillments.length ? recentFulfillments.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{entry.orderReference}</p>
                      <AdminStatus label={entry.accessStatus} tone={statusTone(entry.accessStatus)} />
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{entry.productName}{entry.planName ? " · " + entry.planName : ""}</p>
                    <p className="mt-1 text-xs text-text-muted">{entry.fulfilledAt ? date(entry.fulfilledAt) : "Fulfillment time not recorded"}</p>
                  </div>
                )) : <p className="text-sm text-text-muted">No digital fulfillment activity yet.</p>}
              </div>
            </Surface>
          </div>
        </Container>
      </section>
    );
  } catch (error) {
    return (
      <section className="probee-section">
        <Container>
          <div>
            <p className="probee-label">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">ProBee operations overview</h1>
          </div>
          <AdminErrorState
            message={error instanceof Error ? error.message : "The dashboard could not be loaded."}
          />
        </Container>
      </section>
    );
  }
}
