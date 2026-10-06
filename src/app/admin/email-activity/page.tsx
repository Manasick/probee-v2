import { Container, Surface } from "@/components/ui";
import { AdminStatus } from "@/components/admin/admin-status";
import { getAdminEmailActivity } from "@/lib/admin/operations";

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
  return "/admin/email-activity?" + q.toString();
}

function tone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "sent") return "success";
  if (status === "queued" || status === "sending") return "warning";
  if (status === "failed") return "danger";
  return "info";
}

function date(input: unknown): string {
  return typeof input === "string" ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(input)) : "—";
}

export default async function AdminEmailActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, Param>>;
}) {
  const params = await searchParams;
  const search = value(params.search);
  const status = value(params.status) || "all";
  const page = pageValue(params.page);

  try {
    const result = await getAdminEmailActivity({ search, status, page, pageSize: 25 });
    return (
      <section className="probee-section">
        <Container>
          <div className="max-w-4xl">
            <p className="probee-label">Email activity</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Transactional email operations</h1>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              Staff-only delivery visibility for the existing transactional email log. Email bodies, credentials, and authentication tokens are never shown.
            </p>
          </div>

          <Surface className="mt-8 p-4 sm:p-5">
            <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Search
                <input name="search" defaultValue={search} placeholder="Event, recipient, provider or related ID" className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Delivery status
                <select name="status" defaultValue={status} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary">
                  {["all","queued","sending","sent","failed"].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="flex items-end"><button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse">Apply filters</button></div>
            </form>
          </Surface>

          <div className="mt-8 grid gap-4">
            {result.items.map((raw) => {
              const item = raw as Record<string, unknown>;
              const itemStatus = String(item.status ?? "unknown");
              return (
                <Surface key={String(item.id)} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="probee-label">{String(item.eventType ?? "event")}</p>
                      <h2 className="mt-2 break-all text-base font-semibold">{String(item.recipient ?? "Unknown recipient")}</h2>
                      <p className="mt-1 text-xs text-text-muted">Created {date(item.createdAt)} · Attempts {Number(item.attemptCount ?? 0)}</p>
                    </div>
                    <AdminStatus label={itemStatus} tone={tone(itemStatus)} />
                  </div>

                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div><p className="text-xs text-text-muted">Provider</p><p className="mt-1">{String(item.provider || "Not recorded")}</p></div>
                    <div><p className="text-xs text-text-muted">Provider message ID</p><p className="mt-1 break-all">{String(item.providerMessageId || "Not recorded")}</p></div>
                    <div><p className="text-xs text-text-muted">Sent</p><p className="mt-1">{date(item.sentAt)}</p></div>
                    <div><p className="text-xs text-text-muted">Order</p><p className="mt-1 break-all">{String(item.orderId || "—")}</p></div>
                    <div><p className="text-xs text-text-muted">Payment</p><p className="mt-1 break-all">{String(item.paymentId || "—")}</p></div>
                    <div><p className="text-xs text-text-muted">Entitlement</p><p className="mt-1 break-all">{String(item.entitlementId || "—")}</p></div>
                  </div>

                  {item.failureState ? (
                    <div className="mt-5 rounded-lg border border-red-300/20 bg-red-300/5 p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-red-200">Failure state</p>
                      <p className="mt-1 break-words text-sm text-red-100/80">{String(item.failureState)}</p>
                    </div>
                  ) : null}
                </Surface>
              );
            })}
            {result.items.length === 0 ? <Surface className="p-8 text-center"><p className="font-semibold">No email activity found.</p><p className="mt-2 text-sm text-text-muted">Transactional messages will appear here after real account, order, payment, and digital-delivery events occur.</p></Surface> : null}
          </div>

          {result.pageCount > 1 ? (
            <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Email activity pagination">
              <p className="text-sm text-text-muted">Page {result.page} of {result.pageCount}</p>
              <div className="flex gap-2">
                {result.page > 1 ? <a href={pageHref(search, status, result.page - 1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Previous</a> : null}
                {result.page < result.pageCount ? <a href={pageHref(search, status, result.page + 1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Next</a> : null}
              </div>
            </nav>
          ) : null}
        </Container>
      </section>
    );
  } catch (error) {
    return <section className="probee-section"><Container><p className="probee-label">Email activity</p><h1 className="mt-2 text-3xl font-semibold">Transactional email operations</h1><Surface className="mt-8 border-red-300/20 bg-red-300/5 p-6" role="alert"><p className="font-semibold text-red-100">Email activity could not be loaded.</p><p className="mt-2 text-sm text-red-100/70">{error instanceof Error ? error.message : "Please refresh and try again."}</p></Surface></Container></section>;
  }
}
