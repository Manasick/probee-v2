import Link from "next/link";
import { AdminStatus } from "@/components/admin/admin-status";
import { Container, Surface } from "@/components/ui";
import { getAdminOrders } from "@/lib/admin/operations";

export const dynamic = "force-dynamic";

function value(input: string | string[] | undefined): string {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}
function positivePage(input: string): number {
  const n = Number.parseInt(input, 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
function href(params: Record<string, string>, page: number) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, page: String(page) })) if (v) q.set(k, v);
  return "/admin/orders?" + q.toString();
}
function tone(status: string): "neutral"|"success"|"warning"|"danger"|"info" {
  if (status === "paid" || status === "completed") return "success";
  if (status === "pending" || status === "processing") return "warning";
  if (status === "failed" || status === "cancelled" || status === "refunded" || status === "rejected") return "danger";
  return "info";
}
function money(amount: number | string, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount)); }
  catch { return currency + " " + Number(amount).toFixed(2); }
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const search = value(p.search);
  const status = value(p.status) || "all";
  const paymentStatus = value(p.paymentStatus) || "all";
  const dateFrom = value(p.dateFrom);
  const dateTo = value(p.dateTo);
  const sort = value(p.sort) || "newest";
  const page = positivePage(value(p.page));
  const result = await getAdminOrders({ search, status, paymentStatus, dateFrom, dateTo, sort: sort as "newest"|"oldest"|"total_high"|"total_low", page, pageSize: 20 });
  const params = { search, status, paymentStatus, dateFrom, dateTo, sort };

  return (
    <section className="probee-section"><Container>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-4xl">
          <p className="probee-label">Orders</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Order management</h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">Search and manage historical orders using purchase-time snapshots and the authoritative payment state.</p>
        </div>
      </div>

      <Surface className="mt-8 p-4 sm:p-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-text-secondary md:col-span-2">Search<input name="search" defaultValue={search} placeholder="Order reference, customer name or email" className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
          <label className="grid gap-2 text-sm font-medium text-text-secondary">Order status<select name="status" defaultValue={status} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary"><option>all</option>{["pending","processing","completed","cancelled","failed","refunded"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-medium text-text-secondary">Payment status<select name="paymentStatus" defaultValue={paymentStatus} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary"><option>all</option>{["pending","paid","failed","rejected","refunded"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-medium text-text-secondary">From<input name="dateFrom" type="date" defaultValue={dateFrom} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
          <label className="grid gap-2 text-sm font-medium text-text-secondary">To<input name="dateTo" type="date" defaultValue={dateTo} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
          <label className="grid gap-2 text-sm font-medium text-text-secondary">Sort<select name="sort" defaultValue={sort} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="total_high">Total high</option><option value="total_low">Total low</option></select></label>
          <div className="flex items-end"><button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse">Apply filters</button></div>
        </form>
      </Surface>

      <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--probee-border-subtle)] bg-surface-1">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="border-b border-[var(--probee-border-subtle)] bg-surface-2 text-xs uppercase tracking-[0.08em] text-text-muted"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Subtotal</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Currency</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Order</th><th className="px-4 py-3"></th></tr></thead>
          <tbody>{result.items.map(order=>(
            <tr key={order.id} className="border-b border-[var(--probee-border-subtle)] last:border-0">
              <td className="px-4 py-4"><Link href={"/admin/orders/"+order.id} className="probee-focus-ring font-semibold text-gold">{order.orderReference}</Link></td>
              <td className="px-4 py-4"><p className="font-medium">{order.customerName || "Customer"}</p><p className="mt-1 text-xs text-text-muted">{order.customerEmail || "No email"}</p></td>
              <td className="px-4 py-4 text-xs text-text-muted">{new Date(order.createdAt).toLocaleString()}</td>
              <td className="px-4 py-4">{order.itemCount}</td>
              <td className="px-4 py-4">{money(order.subtotal, order.currency)}</td>
              <td className="px-4 py-4">{money(order.discount, order.currency)}</td>
              <td className="px-4 py-4 font-semibold text-gold">{money(order.total, order.currency)}</td>
              <td className="px-4 py-4">{order.currency}</td>
              <td className="px-4 py-4"><AdminStatus label={order.paymentStatus} tone={tone(order.paymentStatus)} /></td>
              <td className="px-4 py-4"><AdminStatus label={order.orderStatus} tone={tone(order.orderStatus)} /></td>
              <td className="px-4 py-4"><Link href={"/admin/orders/"+order.id} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold">Open</Link></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 md:hidden">
        {result.items.map((order) => (
          <Surface key={order.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={"/admin/orders/" + order.id} className="probee-focus-ring font-semibold text-gold">
                  {order.orderReference}
                </Link>
                <p className="mt-1 text-sm text-text-secondary">{order.customerName || "Customer"}</p>
                <p className="mt-1 text-xs text-text-muted">{order.customerEmail || "No email"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <AdminStatus label={order.paymentStatus} tone={tone(order.paymentStatus)} />
                <AdminStatus label={order.orderStatus} tone={tone(order.orderStatus)} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-text-muted">Items</p><p className="mt-1">{order.itemCount}</p></div>
              <div><p className="text-xs text-text-muted">Date</p><p className="mt-1">{new Date(order.createdAt).toLocaleDateString()}</p></div>
              <div><p className="text-xs text-text-muted">Subtotal</p><p className="mt-1">{money(order.subtotal, order.currency)}</p></div>
              <div><p className="text-xs text-text-muted">Discount</p><p className="mt-1">{money(order.discount, order.currency)}</p></div>
            </div>
            <p className="mt-4 text-lg font-semibold text-gold">{money(order.total, order.currency)}</p>
            <Link href={"/admin/orders/" + order.id} className="probee-focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--probee-border-default)] text-sm font-semibold">
              Open order
            </Link>
          </Surface>
        ))}
      </div>

      {result.items.length === 0 ? <Surface className="mt-4 p-8 text-center"><p className="font-semibold">No orders found.</p><p className="mt-2 text-sm text-text-muted">Try broader filters or wait for the first real order.</p></Surface> : null}

      {result.pageCount > 1 ? <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Order pagination"><p className="text-sm text-text-muted">Page {result.page} of {result.pageCount}</p><div className="flex gap-2">{result.page>1?<Link href={href(params,result.page-1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Previous</Link>:null}{result.page<result.pageCount?<Link href={href(params,result.page+1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Next</Link>:null}</div></nav>:null}
    </Container></section>
  );
}
