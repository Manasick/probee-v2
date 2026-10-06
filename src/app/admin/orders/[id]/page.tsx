import Link from "next/link";
import { AdminStatus } from "@/components/admin/admin-status";
import { AdminConfirmForm } from "@/components/admin/admin-confirm-form";
import { Container, Surface } from "@/components/ui";
import { getAdminOrderDetail } from "@/lib/admin/operations";
import { setOrderStatusAction } from "../actions";

export const dynamic = "force-dynamic";

function money(amount: number | string, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount)); }
  catch { return currency + " " + Number(amount).toFixed(2); }
}
function tone(status: string): "neutral"|"success"|"warning"|"danger"|"info" {
  if (status === "paid" || status === "completed" || status === "active") return "success";
  if (status === "pending" || status === "processing") return "warning";
  if (status === "failed" || status === "cancelled" || status === "refunded" || status === "rejected") return "danger";
  return "info";
}

export default async function AdminOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const { id } = await params;
  const qs = await searchParams;
  const order = await getAdminOrderDetail(id);
  if (!order) return <section className="probee-section"><Container><p className="probee-label">Order</p><h1 className="mt-2 text-3xl font-semibold">Order not found</h1><AdminErrorState message="That order does not exist or is not accessible to staff." /></Container></section>;

  const canChange = !["completed","cancelled","failed","refunded"].includes(order.orderStatus);
  return <section className="probee-section"><Container>
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><p className="probee-label">Order detail</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">{order.orderReference}</h1><p className="mt-3 text-sm text-text-muted">Created {new Date(order.createdAt).toLocaleString()} · Updated {new Date(order.updatedAt).toLocaleString()}</p></div>
      <Link href="/admin/orders" className="probee-focus-ring inline-flex min-h-11 items-center rounded-lg border border-[var(--probee-border-default)] px-4 text-sm font-semibold">Back to orders</Link>
    </div>

    {qs.success ? <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4"><p className="text-sm text-emerald-100">{qs.success}</p></Surface> : null}
    {qs.error ? <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4" role="alert"><p className="text-sm text-red-100">{qs.error}</p></Surface> : null}

    <div className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <Surface className="p-5 sm:p-6">
        <p className="probee-label">Customer</p>
        <h2 className="mt-2 text-xl font-semibold">{order.customerName || "Customer"}</h2>
        <div className="mt-4 grid gap-2 text-sm"><p>Email: {order.customerEmail || "Not recorded"}</p><p>Phone: {order.customerPhone || "Not recorded"}</p></div>
      </Surface>
      <Surface className="p-5 sm:p-6">
        <p className="probee-label">Status</p>
        <div className="mt-4 flex flex-wrap gap-2"><AdminStatus label={order.orderStatus} tone={tone(order.orderStatus)} /><AdminStatus label={order.paymentStatus} tone={tone(order.paymentStatus)} /></div>
        {canChange ? <AdminConfirmForm action={setOrderStatusAction} fields={{ orderId: order.id }} confirmation="Change this order status? Payment status will not be changed. The server will validate the allowed transition." className="mt-5 grid gap-3"><label className="grid gap-2 text-sm font-medium">Order status<select name="orderStatus" defaultValue={order.orderStatus} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3 text-sm"><option value="pending">pending</option><option value="processing">processing</option><option value="completed">completed</option><option value="cancelled">cancelled</option><option value="failed">failed</option></select></label><button type="submit" className="probee-focus-ring min-h-11 rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse">Save order status</button><p className="text-xs text-text-muted">This never changes payment status.</p></AdminConfirmForm> : <p className="mt-4 text-xs text-text-muted">This order is in a terminal status.</p>}
      </Surface>
    </div>

    <Surface className="mt-5 p-5 sm:p-6">
      <p className="probee-label">Purchase snapshot</p>
      <h2 className="mt-2 text-xl font-semibold">Items</h2>
      <div className="mt-5 grid gap-3">{order.items.map(item=><div key={item.id} className="rounded-lg border border-[var(--probee-border-subtle)] bg-surface-2 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.productNameSnapshot}</p><p className="mt-1 text-sm text-text-secondary">{item.planNameSnapshot || "Plan not recorded"} · Qty {item.quantity}</p></div><p className="font-semibold text-gold">{money(item.lineTotal, order.currency)}</p></div><p className="mt-2 text-xs text-text-muted">Unit price at purchase: {money(item.unitPrice, order.currency)}</p></div>)}</div>
      <div className="mt-5 grid gap-2 border-t border-[var(--probee-border-subtle)] pt-5 text-sm"><div className="flex justify-between gap-4"><span>Subtotal</span><span>{money(order.subtotal, order.currency)}</span></div><div className="flex justify-between gap-4"><span>Discount</span><span>{money(order.discount, order.currency)}</span></div><div className="flex justify-between gap-4 text-base font-semibold"><span>Total</span><span className="text-gold">{money(order.total, order.currency)}</span></div><p className="text-xs text-text-muted">Currency: {order.currency}</p></div>
    </Surface>

    <Surface className="mt-5 p-5 sm:p-6">
      <p className="probee-label">Payments</p>
      <h2 className="mt-2 text-xl font-semibold">Payment records</h2>
      <div className="mt-5 grid gap-3">{order.payments.length ? order.payments.map(payment=><div key={payment.id} className="rounded-lg border border-[var(--probee-border-subtle)] bg-surface-2 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{payment.method}</p><p className="mt-1 text-sm text-text-muted">{payment.reference || "No payment reference"}</p></div><AdminStatus label={payment.status} tone={tone(payment.status)}/></div><p className="mt-3 text-sm text-gold">{money(payment.amount, payment.currency)}</p><p className="mt-1 text-xs text-text-muted">Submitted {new Date(payment.createdAt).toLocaleString()}{payment.verifiedAt ? " · Verified " + new Date(payment.verifiedAt).toLocaleString() : ""}</p></div>) : <p className="text-sm text-text-muted">No payment records.</p>}</div>
    </Surface>

    <Surface className="mt-5 p-5 sm:p-6">
      <p className="probee-label">Payment proofs</p>
      <h2 className="mt-2 text-xl font-semibold">Proof metadata</h2>
      <div className="mt-5 grid gap-3">
        {order.paymentProofs.length ? order.paymentProofs.map((proof) => (
          <div key={proof.id} className="rounded-lg border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{proof.originalFilename || "Payment proof"}</p>
                <p className="mt-1 text-xs text-text-muted">{proof.mimeType || "Unknown type"} · {proof.fileSizeBytes ? proof.fileSizeBytes.toLocaleString() : "Unknown size"} bytes</p>
              </div>
              <AdminStatus label={proof.verificationStatus} tone={tone(proof.verificationStatus)} />
            </div>
            <p className="mt-2 text-xs text-text-muted">Submitted {new Date(proof.createdAt).toLocaleString()}{proof.verifiedAt ? " · Verified " + new Date(proof.verifiedAt).toLocaleString() : ""}</p>
            {proof.signedUrl ? <a href={proof.signedUrl} target="_blank" rel="noreferrer" className="probee-focus-ring mt-3 inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold">View proof securely</a> : null}
          </div>
        )) : <p className="text-sm text-text-muted">No payment proof metadata is attached.</p>}
      </div>
    </Surface>

    <Surface className="mt-5 p-5 sm:p-6">
      <p className="probee-label">Digital fulfillment</p>
      <h2 className="mt-2 text-xl font-semibold">Entitlements</h2>
      <div className="mt-5 grid gap-3">{order.digitalEntitlements.length ? order.digitalEntitlements.map(entry=><div key={entry.id} className="rounded-lg border border-[var(--probee-border-subtle)] bg-surface-2 p-4"><div className="flex flex-wrap justify-between gap-3"><p className="font-semibold">Order item {entry.orderItemId.slice(0,8)}</p><AdminStatus label={entry.accessStatus} tone={tone(entry.accessStatus)}/></div><p className="mt-2 text-sm text-text-secondary">Assets linked: {entry.assetCount}</p><p className="mt-1 text-xs text-text-muted">Fulfilled {entry.fulfilledAt ? new Date(entry.fulfilledAt).toLocaleString() : "Not recorded"}{entry.expiresAt ? " · Expires " + new Date(entry.expiresAt).toLocaleString() : ""}</p>{entry.customerAccessUrl ? <p className="mt-2 text-xs text-text-muted">Customer access URL configured (value hidden).</p> : null}</div>) : <p className="text-sm text-text-muted">No digital entitlements for this order.</p>}</div>
      <Link href="/admin/digital-delivery" className="probee-focus-ring mt-5 inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold">Open digital delivery</Link>
    </Surface>
  </Container></section>;
}
