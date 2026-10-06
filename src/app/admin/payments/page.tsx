import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { AdminStatus } from "@/components/admin/admin-status";
import { AdminConfirmForm } from "@/components/admin/admin-confirm-form";
import { getAdminPaymentProofUrls, getAdminPayments } from "@/lib/admin/operations";
import { markManualPaymentPaidAction, rejectManualPaymentAction } from "./actions";

export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;

function value(input: Param): string {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

function pageValue(input: Param): number {
  const parsed = Number.parseInt(value(input), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(search: string, status: string, page: number): string {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (status !== "all") query.set("status", status);
  query.set("page", String(page));
  return "/admin/payments?" + query.toString();
}

function money(amount: unknown, currency: string): string {
  const numeric = typeof amount === "number" ? amount : Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return currency + " " + numeric.toFixed(2);
  }
}

function tone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "failed" || status === "refunded") return "danger";
  return "info";
}

function date(value: unknown): string {
  return typeof value === "string"
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, Param>>;
}) {
  const params = await searchParams;
  const search = value(params.search);
  const status = value(params.status) || "all";
  const page = pageValue(params.page);
  const success = value(params.success);
  const error = value(params.error);

  try {
    const result = await getAdminPayments({ search, status, page, pageSize: 20 });
    const proofIds = result.items
      .map((item) => (item.proof && typeof item.proof === "object" ? String((item.proof as Record<string, unknown>).id ?? "") : ""))
      .filter(Boolean);
    const proofUrls = await getAdminPaymentProofUrls(proofIds);

    return (
      <section className="probee-section">
        <Container>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-4xl">
              <p className="probee-label">Payments</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
                Payment verification
              </h1>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                Staff-only review of manual bank-transfer submissions. Payment verification remains independent from order status.
              </p>
            </div>
          </div>

          {success ? (
            <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4"><p className="text-sm text-emerald-100">{success}</p></Surface>
          ) : null}
          {error ? (
            <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4" role="alert"><p className="text-sm text-red-100">{error}</p></Surface>
          ) : null}

          <Surface className="mt-8 p-4 sm:p-5">
            <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Search
                <input name="search" defaultValue={search} placeholder="Order, customer or payment reference" className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Payment status
                <select name="status" defaultValue={status} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary">
                  {["all","pending","paid","rejected","failed","refunded"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="flex items-end"><button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse">Apply filters</button></div>
            </form>
          </Surface>

          <div className="mt-8 grid gap-4">
            {result.items.map((item) => {
              const payment = item as Record<string, unknown>;
              const proof = payment.proof && typeof payment.proof === "object" ? payment.proof as Record<string, unknown> : null;
              const proofId = proof ? String(proof.id ?? "") : "";
              const proofUrl = proofId ? proofUrls.get(proofId) : undefined;
              const paymentStatus = String(payment.paymentStatus ?? "unknown");

              return (
                <Surface key={String(payment.id)} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="probee-label">Order {String(payment.orderReference ?? "Unknown")}</p>
                      <h2 className="mt-2 text-lg font-semibold">{String(payment.customerName || payment.customerEmail || "Customer")}</h2>
                      <p className="mt-1 text-sm text-text-muted">{String(payment.customerEmail || "No email")}</p>
                    </div>
                    <AdminStatus label={paymentStatus} tone={tone(paymentStatus)} />
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div><p className="text-xs text-text-muted">Amount</p><p className="mt-1 font-semibold text-gold">{money(payment.amount, String(payment.currency ?? "USD"))}</p></div>
                    <div><p className="text-xs text-text-muted">Payment reference</p><p className="mt-1 text-sm">{String(payment.paymentReference || "Not supplied")}</p></div>
                    <div><p className="text-xs text-text-muted">Submitted</p><p className="mt-1 text-sm">{date(payment.createdAt)}</p></div>
                    <div><p className="text-xs text-text-muted">Verified</p><p className="mt-1 text-sm">{date(payment.verifiedAt)}</p></div>
                    <div><p className="text-xs text-text-muted">Order status</p><p className="mt-1 text-sm">{String(payment.orderStatus ?? "Unknown")}</p></div>
                    <div><p className="text-xs text-text-muted">Currency</p><p className="mt-1 text-sm">{String(payment.currency ?? "—")}</p></div>
                  </div>

                  {proof ? (
                    <div className="mt-5 rounded-lg border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                      <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Payment proof</p>
                      <p className="mt-1 text-sm text-text-primary">{String(proof.originalFilename || "Uploaded proof")}</p>
                      <p className="mt-1 text-xs text-text-muted">{String(proof.mimeType || "Unknown type")} · {String(proof.fileSizeBytes || 0)} bytes · {String(proof.verificationStatus || "pending")}</p>
                      {proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer" className="probee-focus-ring mt-3 inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold">View proof securely</a> : null}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-lg border border-dashed border-[var(--probee-border-default)] p-4 text-sm text-text-muted">No payment proof attached.</div>
                  )}

                  {paymentStatus === "pending" ? (
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <AdminConfirmForm action={markManualPaymentPaidAction} fields={{ paymentId: String(payment.id) }} confirmation="Mark this manual payment as paid? The secure payment workflow will validate the payment and amount before changing state.">
                        <button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse sm:w-auto">Mark as paid</button>
                      </AdminConfirmForm>
                      <AdminConfirmForm action={rejectManualPaymentAction} fields={{ paymentId: String(payment.id) }} confirmation="Reject this payment proof? This will keep the order unpaid.">
                        <button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg border border-red-300/20 bg-red-300/5 px-4 text-sm font-semibold text-red-100 sm:w-auto">Reject payment</button>
                      </AdminConfirmForm>
                    </div>
                  ) : null}
                </Surface>
              );
            })}
            {result.items.length === 0 ? <Surface className="p-8 text-center"><p className="font-semibold">No payment records found.</p><p className="mt-2 text-sm text-text-muted">Pending manual bank-transfer submissions will appear here.</p></Surface> : null}
          </div>

          {result.pageCount > 1 ? (
            <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Payment pagination">
              <p className="text-sm text-text-muted">Page {result.page} of {result.pageCount}</p>
              <div className="flex gap-2">
                {result.page > 1 ? <Link href={pageHref(search, status, result.page - 1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Previous</Link> : null}
                {result.page < result.pageCount ? <Link href={pageHref(search, status, result.page + 1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Next</Link> : null}
              </div>
            </nav>
          ) : null}
        </Container>
      </section>
    );
  } catch (loadError) {
    return <section className="probee-section"><Container><p className="probee-label">Payments</p><h1 className="mt-2 text-3xl font-semibold">Payment verification</h1><Surface className="mt-8 border-red-300/20 bg-red-300/5 p-6" role="alert"><p className="font-semibold text-red-100">Payment records could not be loaded.</p><p className="mt-2 text-sm text-red-100/70">{loadError instanceof Error ? loadError.message : "Please refresh and try again."}</p></Surface></Container></section>;
  }
}
