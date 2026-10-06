import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "./auth";
import { getAdminReviews } from "@/lib/reviews/server";

export interface AdminDashboardStats {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  failedOrders: number;
  totalPaidSalesByCurrency: Record<string, number>;
  pendingPayments: number;
  paidPayments: number;
  rejectedPayments: number;
  totalCustomers: number;
  activeProducts: number;
  publishedProducts: number;
  pendingReviews: number;
  activeDigitalEntitlements: number;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  recentOrders: Array<{
    id: string;
    orderReference: string;
    customerName: string | null;
    customerEmail: string | null;
    total: number | string;
    currency: string;
    paymentStatus: string;
    orderStatus: string;
    createdAt: string;
  }>;
  recentPayments: Array<{
    id: string;
    orderReference: string;
    customerName: string | null;
    amount: number | string;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  pendingReviews: Awaited<ReturnType<typeof getAdminReviews>>["items"];
  recentFulfillments: Array<{
    id: string;
    orderReference: string;
    productName: string;
    planName: string | null;
    accessStatus: string;
    fulfilledAt: string | null;
  }>;
}

function parseStats(value: unknown): AdminDashboardStats {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  const salesRecord = record.totalPaidSalesByCurrency &&
      typeof record.totalPaidSalesByCurrency === "object" &&
      !Array.isArray(record.totalPaidSalesByCurrency)
    ? record.totalPaidSalesByCurrency as Record<string, unknown>
    : {};

  const numberValue = (key: string) => Number(record[key] ?? 0);

  return {
    totalOrders: numberValue("totalOrders"),
    pendingOrders: numberValue("pendingOrders"),
    processingOrders: numberValue("processingOrders"),
    completedOrders: numberValue("completedOrders"),
    cancelledOrders: numberValue("cancelledOrders"),
    failedOrders: numberValue("failedOrders"),
    totalPaidSalesByCurrency: Object.fromEntries(
      Object.entries(salesRecord).map(([currency, amount]) => [
        currency,
        Number(amount ?? 0),
      ]),
    ),
    pendingPayments: numberValue("pendingPayments"),
    paidPayments: numberValue("paidPayments"),
    rejectedPayments: numberValue("rejectedPayments"),
    totalCustomers: numberValue("totalCustomers"),
    activeProducts: numberValue("activeProducts"),
    publishedProducts: numberValue("publishedProducts"),
    pendingReviews: numberValue("pendingReviews"),
    activeDigitalEntitlements: numberValue("activeDigitalEntitlements"),
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: statsRaw, error: statsError }, recentOrdersResult, recentPaymentsResult, recentFulfillmentsResult, reviewsResult] =
    await Promise.all([
      supabase.rpc("get_admin_dashboard_stats"),
      supabase
        .from("orders")
        .select("id,order_reference,customer_name,customer_email,total,currency,payment_status,order_status,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("payments")
        .select("id,amount,currency,payment_status,created_at,order:orders(order_reference,customer_name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("digital_entitlements")
        .select("id,access_status,fulfilled_at,order:orders(order_reference),order_item:order_items(product_name_snapshot,plan_name_snapshot)")
        .order("created_at", { ascending: false })
        .limit(5),
      getAdminReviews("pending", 1, ""),
    ]);

  if (statsError) {
    throw new Error("The admin dashboard statistics could not be loaded.");
  }

  const recentPayments = (recentPaymentsResult.data ?? []).map((row) => {
    const order = Array.isArray(row.order) ? row.order[0] : row.order;
    return {
      id: row.id,
      orderReference: order?.order_reference ?? "Unknown",
      customerName: order?.customer_name ?? null,
      amount: row.amount,
      currency: row.currency,
      status: row.payment_status,
      createdAt: row.created_at,
    };
  });

  const recentFulfillments = (recentFulfillmentsResult.data ?? []).map((row) => {
    const order = Array.isArray(row.order) ? row.order[0] : row.order;
    const item = Array.isArray(row.order_item) ? row.order_item[0] : row.order_item;
    return {
      id: row.id,
      orderReference: order?.order_reference ?? "Unknown",
      productName: item?.product_name_snapshot ?? "Digital product",
      planName: item?.plan_name_snapshot ?? null,
      accessStatus: row.access_status,
      fulfilledAt: row.fulfilled_at,
    };
  });

  return {
    stats: parseStats(statsRaw),
    recentOrders: (recentOrdersResult.data ?? []).map((row) => ({
      id: row.id,
      orderReference: row.order_reference,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      total: row.total,
      currency: row.currency,
      paymentStatus: row.payment_status,
      orderStatus: row.order_status,
      createdAt: row.created_at,
    })),
    recentPayments,
    pendingReviews: reviewsResult.items.slice(0, 5),
    recentFulfillments,
  };
}
