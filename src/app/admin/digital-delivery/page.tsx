import { Container, Surface } from "@/components/ui";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import {
  fulfillDigitalOrderItemAction,
  setDigitalEntitlementStatusAction,
} from "./fulfillment-actions";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  order_reference: string;
  user_id: string | null;
  order_status: string;
  payment_status: string;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  plan_id: string | null;
  product_name_snapshot: string;
  plan_name_snapshot: string | null;
  quantity: number;
}

interface ProductRow {
  id: string;
  product_type: string;
  delivery_type: string | null;
}

interface PlanRow {
  id: string;
  product_id: string;
  delivery_type: string | null;
}

interface EntitlementRow {
  id: string;
  order_item_id: string;
  access_status: string;
  delivery_type: string | null;
  customer_access_url: string | null;
  fulfilled_at: string | null;
  expires_at: string | null;
}

interface AssetLinkRow {
  entitlement_id: string;
  asset_id: string;
}

function getEligibility(
  product: ProductRow | undefined,
  plan: PlanRow | undefined,
): { eligible: boolean; deliveryType: string | null; reason: string } {
  if (
    !product ||
    !["digital", "license", "subscription"].includes(product.product_type)
  ) {
    return {
      eligible: false,
      deliveryType: null,
      reason: "Not a digital product",
    };
  }

  const deliveryType =
    plan?.delivery_type?.trim() ||
    product.delivery_type?.trim() ||
    null;

  if (!deliveryType) {
    return {
      eligible: false,
      deliveryType: null,
      reason: "Delivery type not configured",
    };
  }

  return { eligible: true, deliveryType, reason: "" };
}

export default async function DigitalDeliveryAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id,order_reference,user_id,order_status,payment_status,customer_name,customer_email,created_at",
    )
    .eq("payment_status", "paid")
    .not("order_status", "in", "(cancelled,failed,refunded)")
    .order("created_at", { ascending: false })
    .limit(100);

  const orderRows = (orders ?? []) as OrderRow[];
  const orderIds = orderRows.map((order) => order.id);

  let itemRows: OrderItemRow[] = [];
  if (orderIds.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select(
        "id,order_id,product_id,plan_id,product_name_snapshot,plan_name_snapshot,quantity",
      )
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    itemRows = (data ?? []) as OrderItemRow[];
  }

  const productIds = [
    ...new Set(itemRows.map((item) => item.product_id).filter(Boolean)),
  ] as string[];
  const planIds = [
    ...new Set(itemRows.map((item) => item.plan_id).filter(Boolean)),
  ] as string[];

  const [{ data: products }, { data: plans }, { data: entitlements }] =
    await Promise.all([
      productIds.length
        ? supabase
            .from("products")
            .select("id,product_type,delivery_type")
            .in("id", productIds)
        : Promise.resolve({ data: [] }),
      planIds.length
        ? supabase
            .from("product_plans")
            .select("id,product_id,delivery_type")
            .in("id", planIds)
        : Promise.resolve({ data: [] }),
      itemRows.length
        ? supabase
            .from("digital_entitlements")
            .select(
              "id,order_item_id,access_status,delivery_type,customer_access_url,fulfilled_at,expires_at",
            )
            .in(
              "order_item_id",
              itemRows.map((item) => item.id),
            )
        : Promise.resolve({ data: [] }),
    ]);

  const productMap = new Map(
    ((products ?? []) as ProductRow[]).map((product) => [
      product.id,
      product,
    ]),
  );
  const planMap = new Map(
    ((plans ?? []) as PlanRow[]).map((plan) => [plan.id, plan]),
  );
  const entitlementMap = new Map(
    ((entitlements ?? []) as EntitlementRow[]).map((entitlement) => [
      entitlement.order_item_id,
      entitlement,
    ]),
  );

  let assetLinks: AssetLinkRow[] = [];
  const entitlementIds = (entitlements ?? []).map((entitlement) => entitlement.id);

  if (entitlementIds.length > 0) {
    const { data } = await supabase
      .from("digital_entitlement_assets")
      .select("entitlement_id,asset_id")
      .in("entitlement_id", entitlementIds);

    assetLinks = (data ?? []) as AssetLinkRow[];
  }

  const assetCountMap = new Map<string, number>();
  for (const link of assetLinks) {
    assetCountMap.set(
      link.entitlement_id,
      (assetCountMap.get(link.entitlement_id) ?? 0) + 1,
    );
  }

  const rows = itemRows
    .map((item) => ({
      order: orderRows.find((order) => order.id === item.order_id),
      item,
      entitlement: entitlementMap.get(item.id),
      eligibility: getEligibility(
        item.product_id ? productMap.get(item.product_id) : undefined,
        item.plan_id ? planMap.get(item.plan_id) : undefined,
      ),
    }))
    .filter((row) => row.order);

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Digital delivery</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Fulfill customer digital access
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Only verified-paid, eligible order items appear here. Fulfillment
            creates one entitlement per purchased order item and never changes
            order or payment status.
          </p>
        </div>

        {params.success ? (
          <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4">
            <p className="text-sm text-emerald-100">{params.success}</p>
          </Surface>
        ) : null}

        {params.error ? (
          <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4">
            <p className="text-sm text-red-100">{params.error}</p>
          </Surface>
        ) : null}

        {ordersError ? (
          <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="text-sm font-semibold text-red-100">
              Digital fulfillment data could not be loaded.
            </p>
            <p className="mt-2 text-sm leading-6 text-red-100/70">
              Please refresh and try again later.
            </p>
          </Surface>
        ) : null}

        <Surface className="mt-8 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="probee-label">Paid orders</p>
              <h2 className="mt-2 text-xl font-semibold">
                Digital fulfillment queue
              </h2>
            </div>
            <a
              href="/admin/digital-delivery/assets"
              className="probee-focus-ring inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary hover:bg-surface-3"
            >
              Manage digital files
            </a>
          </div>

          <div className="mt-6 grid gap-4">
            {rows.length > 0 ? (
              rows.map((row) => {
                const order = row.order as OrderRow;
                const item = row.item;
                const entitlement = row.entitlement;
                const result = row.eligibility;
                const assetCount = entitlement
                  ? assetCountMap.get(entitlement.id) ?? 0
                  : 0;

                return (
                  <div
                    key={item.id}
                    className="rounded-[var(--probee-radius-lg)] border border-[var(--probee-border-subtle)] bg-surface-2 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
                          {order.order_reference}
                        </p>
                        <p className="mt-1 text-base font-semibold">
                          {item.product_name_snapshot}
                        </p>
                        {item.plan_name_snapshot ? (
                          <p className="mt-1 text-sm text-text-secondary">
                            {item.plan_name_snapshot}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-text-muted">
                          Customer:{" "}
                          {order.customer_name ||
                            order.customer_email ||
                            "Account customer"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex min-h-7 items-center rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-emerald-100">
                          Paid
                        </span>
                        {result.eligible ? (
                          <span className="inline-flex min-h-7 items-center rounded-full border border-gold/20 bg-gold-soft px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-gold">
                            {result.deliveryType}
                          </span>
                        ) : (
                          <span className="inline-flex min-h-7 items-center rounded-full border border-amber-300/20 bg-amber-300/5 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-amber-100">
                            {result.reason}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-[var(--probee-border-subtle)] pt-5">
                      {!result.eligible ? (
                        <p className="text-sm leading-6 text-text-muted">
                          Configure a digital delivery type on the product or
                          purchased plan before fulfilling this item.
                        </p>
                      ) : entitlement ? (
                        <div className="grid gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold">
                                Entitlement {entitlement.access_status}
                              </p>
                              <p className="mt-1 text-xs text-text-muted">
                                Assets: {assetCount} · Fulfilled{" "}
                                {entitlement.fulfilled_at
                                  ? new Date(
                                      entitlement.fulfilled_at,
                                    ).toLocaleString()
                                  : "not recorded"}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {entitlement.access_status === "active" ? (
                                <>
                                  <form action={setDigitalEntitlementStatusAction}>
                                    <input
                                      type="hidden"
                                      name="entitlementId"
                                      value={entitlement.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="accessStatus"
                                      value="suspended"
                                    />
                                    <button
                                      type="submit"
                                      className="probee-focus-ring min-h-10 rounded-[var(--probee-radius-md)] border border-amber-300/20 bg-amber-300/5 px-3 text-xs font-semibold text-amber-100 hover:bg-amber-300/10"
                                    >
                                      Suspend
                                    </button>
                                  </form>
                                  <form action={setDigitalEntitlementStatusAction}>
                                    <input
                                      type="hidden"
                                      name="entitlementId"
                                      value={entitlement.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="accessStatus"
                                      value="revoked"
                                    />
                                    <button
                                      type="submit"
                                      className="probee-focus-ring min-h-10 rounded-[var(--probee-radius-md)] border border-red-300/20 bg-red-300/5 px-3 text-xs font-semibold text-red-100 hover:bg-red-300/10"
                                    >
                                      Revoke
                                    </button>
                                  </form>
                                </>
                              ) : entitlement.access_status === "suspended" ||
                                entitlement.access_status === "revoked" ? (
                                <form action={setDigitalEntitlementStatusAction}>
                                  <input
                                    type="hidden"
                                    name="entitlementId"
                                    value={entitlement.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="accessStatus"
                                    value="active"
                                  />
                                  <button
                                    type="submit"
                                    className="probee-focus-ring min-h-10 rounded-[var(--probee-radius-md)] bg-gold px-3 text-xs font-semibold text-text-inverse hover:bg-gold-hover"
                                  >
                                    Reactivate
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>

                          {entitlement.customer_access_url ? (
                            <p className="text-xs text-text-muted">
                              Customer access URL configured.
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <form
                          action={fulfillDigitalOrderItemAction}
                          className="grid gap-4 lg:grid-cols-[1fr_auto]"
                        >
                          <div>
                            <label
                              htmlFor={"access-url-" + item.id}
                              className="mb-2 block text-sm font-medium text-text-secondary"
                            >
                              Optional customer access URL
                            </label>
                            <input
                              id={"access-url-" + item.id}
                              name="customerAccessUrl"
                              type="url"
                              inputMode="url"
                              placeholder="https://…"
                              maxLength={2048}
                              className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                            />
                            <p className="mt-2 text-xs text-text-muted">
                              Use only a customer-safe HTTPS address. Never enter passwords or private credentials.
                            </p>
                          </div>
                          <div className="flex items-end">
                            <input type="hidden" name="orderItemId" value={item.id} />
                            <button
                              type="submit"
                              className="probee-focus-ring min-h-11 w-full rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover lg:w-auto"
                            >
                              Fulfill entitlement
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-5">
                <p className="text-sm font-semibold">
                  Nothing is waiting for digital fulfillment.
                </p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Paid, eligible digital order items will appear here.
                </p>
              </div>
            )}
          </div>
        </Surface>
      </Container>
    </section>
  );
}