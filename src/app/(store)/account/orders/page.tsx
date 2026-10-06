import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { AccountNav } from "@/components/store/account-nav";
import { StatusBadge } from "@/components/store/status-badge";
import { EmptyState } from "@/components/store/empty-state";
import { requireAuthenticated } from "@/lib/auth/server";
import {
  formatCurrency,
  formatDate,
} from "@/lib/orders/presentation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ORDER_STATUS_FILTERS = [
  "pending",
  "processing",
  "completed",
  "cancelled",
  "failed",
  "refunded",
] as const;

function getSingleParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildOrdersHref(
  page: number,
  search: string,
  status: string,
): string {
  const params = new URLSearchParams();

  if (search) {
    params.set("q", search);
  }

  if (status) {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? "/account/orders?" + query : "/account/orders";
}

interface OrderRow {
  id: string;
  order_reference: string;
  order_status: string;
  payment_status: string;
  total: number | string;
  currency: string;
  created_at: string;
}

interface ItemRow {
  order_id: string;
  product_name_snapshot: string;
  plan_name_snapshot: string | null;
  quantity: number;
}

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAuthenticated("/account/orders");
  const params = await searchParams;

  const rawSearch = getSingleParam(params.q).trim();
  const search = rawSearch.slice(0, 64);
  const rawStatus = getSingleParam(params.status);
  const status = ORDER_STATUS_FILTERS.includes(
    rawStatus as (typeof ORDER_STATUS_FILTERS)[number],
  )
    ? rawStatus
    : "";

  const pageValue = Number.parseInt(getSingleParam(params.page), 10);
  const page = Number.isFinite(pageValue) && pageValue > 0
    ? Math.min(pageValue, 1000)
    : 1;

  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createClient();

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id,order_reference,order_status,payment_status,total,currency,created_at",
      { count: "exact" },
    )
    .eq("user_id", context.user.id);

  if (status) {
    ordersQuery = ordersQuery.eq("order_status", status);
  }

  if (search) {
    const escaped = search.replace(/[\\%_]/g, "\\$&");
    ordersQuery = ordersQuery.ilike("order_reference", "%" + escaped + "%");
  }

  ordersQuery = ordersQuery
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data: orders, count, error } = await ordersQuery;

  const pageTitle = search || status ? "Your orders" : "Order history";

  let itemRows: ItemRow[] = [];

  if (!error && orders && orders.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select("order_id,product_name_snapshot,plan_name_snapshot,quantity")
      .in(
        "order_id",
        orders.map((order) => order.id),
      )
      .order("created_at", { ascending: true });

    itemRows = (data ?? []) as ItemRow[];
  }

  const itemMap = new Map<
    string,
    { totalQuantity: number; primaryProduct: string; primaryPlan: string | null }
  >();

  for (const item of itemRows) {
    const existing = itemMap.get(item.order_id);

    if (existing) {
      existing.totalQuantity += item.quantity;
      continue;
    }

    itemMap.set(item.order_id, {
      totalQuantity: item.quantity,
      primaryProduct: item.product_name_snapshot,
      primaryPlan: item.plan_name_snapshot,
    });
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Orders</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            {pageTitle}
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            View your own ProBee orders, payment states, totals, and tracking.
          </p>
        </div>

        <div className="mt-8">
          <AccountNav />
        </div>

        <Surface className="mt-8 p-5 sm:p-6">
          <form
            method="get"
            className="grid gap-4 lg:grid-cols-[1fr_220px_auto]"
          >
            <div>
              <label
                htmlFor="orders-search"
                className="mb-2 block text-sm font-medium text-text-secondary"
              >
                Search your orders
              </label>
              <input
                id="orders-search"
                name="q"
                type="search"
                defaultValue={search}
                placeholder="Order reference"
                maxLength={64}
                className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
              />
            </div>

            <div>
              <label
                htmlFor="orders-status"
                className="mb-2 block text-sm font-medium text-text-secondary"
              >
                Filter by status
              </label>
              <select
                id="orders-status"
                name="status"
                defaultValue={status}
                className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
              >
                <option value="">All statuses</option>
                {ORDER_STATUS_FILTERS.map((item) => (
                  <option key={item} value={item}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="probee-focus-ring min-h-11 w-full rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover lg:w-auto"
              >
                Apply
              </button>
            </div>
          </form>
        </Surface>

        {error ? (
          <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="text-sm font-semibold text-red-100">
              Your orders could not be loaded.
            </p>
            <p className="mt-2 text-sm leading-6 text-red-100/70">
              Please refresh the page or try again later.
            </p>
          </Surface>
        ) : orders && orders.length > 0 ? (
          <div className="mt-6 grid gap-4">
            {orders.map((order) => {
              const itemSummary = itemMap.get(order.id);

              return (
                <Surface key={order.id} tone="interactive" className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
                        Order reference
                      </p>
                      <Link
                        href={"/account/orders/" + encodeURIComponent(order.order_reference)}
                        className="probee-focus-ring mt-1 inline-block rounded text-lg font-semibold text-gold hover:text-gold-hover"
                      >
                        {order.order_reference}
                      </Link>
                      {itemSummary ? (
                        <p className="mt-2 text-sm text-text-secondary">
                          {itemSummary.primaryProduct}
                          {itemSummary.primaryPlan
                            ? " · " + itemSummary.primaryPlan
                            : ""}
                          {itemSummary.totalQuantity > 1
                            ? " · " + itemSummary.totalQuantity + " items"
                            : " · 1 item"}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-text-muted">
                        {formatDate(order.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <StatusBadge kind="order" status={order.order_status} />
                      <StatusBadge kind="payment" status={order.payment_status} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-4 border-t border-[var(--probee-border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
                        Total
                      </p>
                      <p className="mt-1 text-xl font-semibold text-text-primary">
                        {formatCurrency(order.total, order.currency)}
                      </p>
                    </div>

                    <Link
                      href={"/account/orders/" + encodeURIComponent(order.order_reference)}
                      className="probee-focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-3 sm:w-auto"
                    >
                      View order
                    </Link>
                  </div>
                </Surface>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title={search || status ? "No matching orders" : "No orders yet"}
              description={
                search || status
                  ? "Try a different order reference or status filter."
                  : "Orders you place through ProBee will appear here."
              }
              action={
                <Link
                  href={search || status ? "/account/orders" : "/products"}
                  className="probee-focus-ring inline-flex min-h-11 items-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                >
                  {search || status ? "View all orders" : "Browse products"}
                </Link>
              }
            />
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-[var(--probee-border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildOrdersHref(page - 1, search, status)}
                  className="probee-focus-ring inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildOrdersHref(page + 1, search, status)}
                  className="probee-focus-ring inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
