import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { AdminStatus } from "@/components/admin/admin-status";
import { getAdminDigitalQueue } from "@/lib/admin/operations";
import {
  fulfillDigitalOrderItemAction,
  setDigitalEntitlementStatusAction,
} from "./fulfillment-actions";

export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;

function value(input: Param): string {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

function pageValue(input: Param): number {
  const n = Number.parseInt(value(input), 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function pageHref(search: string, status: string, page: number): string {
  const q = new URLSearchParams();
  if (search) q.set("search", search);
  if (status !== "all") q.set("status", status);
  q.set("page", String(page));
  return "/admin/digital-delivery?" + q.toString();
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "active" || status === "paid") return "success";
  if (status === "pending" || status === "suspended" || status === "processing") return "warning";
  if (status === "revoked" || status === "expired" || status === "failed" || status === "cancelled") return "danger";
  return "info";
}

export default async function DigitalDeliveryAdminPage({
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
    const result = await getAdminDigitalQueue({ search, status, page, pageSize: 20 });

    return (
      <section className="probee-section">
        <Container>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-4xl">
              <p className="probee-label">Digital delivery</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Fulfillment operations</h1>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                Paid digital order items are derived from the authoritative order relationship. Fulfillment never changes payment status.
              </p>
            </div>
            <Link href="/admin/digital-delivery/assets" className="probee-focus-ring inline-flex min-h-11 items-center rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold">Manage digital assets</Link>
          </div>

          {success ? <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4"><p className="text-sm text-emerald-100">{success}</p></Surface> : null}
          {error ? <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4" role="alert"><p className="text-sm text-red-100">{error}</p></Surface> : null}

          <Surface className="mt-8 p-4 sm:p-5">
            <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Search
                <input name="search" defaultValue={search} placeholder="Order, customer, product or plan" className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Fulfillment status
                <select name="status" defaultValue={status} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary">
                  {["all","pending","active","suspended","expired","revoked"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="flex items-end"><button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse">Apply filters</button></div>
            </form>
          </Surface>

          <div className="mt-8 grid gap-4">
            {result.items.map((raw) => {
              const item = raw as Record<string, unknown>;
              const entitlementId = item.entitlementId ? String(item.entitlementId) : "";
              const accessStatus = item.accessStatus ? String(item.accessStatus) : "pending";
              const eligible = item.eligible === true;
              return (
                <Surface key={String(item.orderItemId)} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="probee-label">Order {String(item.orderReference ?? "Unknown")}</p>
                      <h2 className="mt-2 text-lg font-semibold">{String(item.productName ?? "Digital product")}</h2>
                      {item.planName ? <p className="mt-1 text-sm text-text-secondary">{String(item.planName)}</p> : null}
                      <p className="mt-2 text-xs text-text-muted">{String(item.customerName || item.customerEmail || "Customer")} · Qty {Number(item.quantity ?? 1)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatus label="paid" tone="success" />
                      {eligible ? <AdminStatus label={String(item.deliveryType ?? "digital")} tone="info" /> : <AdminStatus label="Not eligible" tone="warning" />}
                      {entitlementId ? <AdminStatus label={accessStatus} tone={statusTone(accessStatus)} /> : <AdminStatus label="pending" tone="warning" />}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[var(--probee-border-subtle)] pt-5">
                    {!eligible ? (
                      <p className="text-sm leading-6 text-text-muted">Digital delivery is not configured for this purchased product or plan. Configure the catalog before fulfillment.</p>
                    ) : entitlementId ? (
                      <div className="grid gap-4">
                        <div className="grid gap-2 text-sm sm:grid-cols-3">
                          <p><span className="text-text-muted">Assets:</span> {Number(item.assetCount ?? 0)}</p>
                          <p><span className="text-text-muted">Fulfilled:</span> {item.fulfilledAt ? new Date(String(item.fulfilledAt)).toLocaleString() : "Not recorded"}</p>
                          <p><span className="text-text-muted">Expires:</span> {item.expiresAt ? new Date(String(item.expiresAt)).toLocaleString() : "No expiry"}</p>
                        </div>
                        {item.customerAccessUrlConfigured ? <p className="text-xs text-text-muted">A customer access URL is configured. Its value is hidden from the operations list.</p> : null}
                        <div className="flex flex-wrap gap-2">
                          {accessStatus === "active" ? (
                            <>
                              <form action={setDigitalEntitlementStatusAction}><input type="hidden" name="entitlementId" value={entitlementId}/><input type="hidden" name="accessStatus" value="suspended"/><button type="submit" className="probee-focus-ring min-h-10 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 text-xs font-semibold text-amber-100">Suspend</button></form>
                              <form action={setDigitalEntitlementStatusAction}><input type="hidden" name="entitlementId" value={entitlementId}/><input type="hidden" name="accessStatus" value="revoked"/><button type="submit" className="probee-focus-ring min-h-10 rounded-lg border border-red-300/20 bg-red-300/5 px-3 text-xs font-semibold text-red-100">Revoke</button></form>
                            </>
                          ) : accessStatus === "suspended" || accessStatus === "revoked" ? (
                            <form action={setDigitalEntitlementStatusAction}><input type="hidden" name="entitlementId" value={entitlementId}/><input type="hidden" name="accessStatus" value="active"/><button type="submit" className="probee-focus-ring min-h-10 rounded-lg bg-gold px-3 text-xs font-semibold text-text-inverse">Reactivate</button></form>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <form action={fulfillDigitalOrderItemAction} className="grid gap-4 lg:grid-cols-[1fr_auto]">
                        <div>
                          <label htmlFor={"access-url-" + String(item.orderItemId)} className="mb-2 block text-sm font-medium text-text-secondary">Optional customer access URL</label>
                          <input id={"access-url-" + String(item.orderItemId)} name="customerAccessUrl" type="url" inputMode="url" maxLength={2048} placeholder="https://…" className="min-h-11 w-full rounded-lg border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary" />
                          <p className="mt-2 text-xs text-text-muted">Only enter a customer-safe HTTPS address. Never put passwords or supplier credentials here.</p>
                        </div>
                        <div className="flex items-end"><input type="hidden" name="orderItemId" value={String(item.orderItemId)} /><button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse lg:w-auto">Fulfill entitlement</button></div>
                      </form>
                    )}
                  </div>
                </Surface>
              );
            })}

            {result.items.length === 0 ? <Surface className="p-8 text-center"><p className="font-semibold">No digital fulfillment records found.</p><p className="mt-2 text-sm text-text-muted">Paid eligible digital purchases will appear here when they exist.</p></Surface> : null}
          </div>

          {result.pageCount > 1 ? (
            <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Digital delivery pagination">
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
    return <section className="probee-section"><Container><p className="probee-label">Digital delivery</p><h1 className="mt-2 text-3xl font-semibold">Fulfillment operations</h1><Surface className="mt-8 border-red-300/20 bg-red-300/5 p-6" role="alert"><p className="font-semibold text-red-100">Digital fulfillment data could not be loaded.</p><p className="mt-2 text-sm text-red-100/70">{loadError instanceof Error ? loadError.message : "Please refresh and try again."}</p></Surface></Container></section>;
  }
}
