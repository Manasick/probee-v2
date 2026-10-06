import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "./auth";
import { sanitizeSearchTerm, isUuid } from "./validation";

export interface AdminOrderListResult {
  items: Array<{
    id: string;
    orderReference: string;
    customerName: string | null;
    customerEmail: string | null;
    createdAt: string;
    itemCount: number;
    subtotal: number | string;
    discount: number | string;
    total: number | string;
    currency: string;
    paymentStatus: string;
    orderStatus: string;
  }>;
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function getAdminOrders(options: {
  search?: string;
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest" | "total_high" | "total_low";
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminOrderListResult> {
  await requireStaff();
  const supabase = await createClient();
  const page = Math.max(1, Math.min(options.page ?? 1, 100000));
  const pageSize = Math.max(10, Math.min(options.pageSize ?? 20, 50));
  const offset = (page - 1) * pageSize;
  const safeSearch = sanitizeSearchTerm(options.search ?? "");

  let query = supabase
    .from("orders")
    .select("id,order_reference,customer_name,customer_email,created_at,subtotal,discount,total,currency,payment_status,order_status", { count: "exact" });

  if (safeSearch) {
    query = query.or(
      "order_reference.ilike.%" + safeSearch + "%,customer_name.ilike.%" + safeSearch + "%,customer_email.ilike.%" + safeSearch + "%"
    );
  }
  if (options.status && options.status !== "all") query = query.eq("order_status", options.status);
  if (options.paymentStatus && options.paymentStatus !== "all") query = query.eq("payment_status", options.paymentStatus);
  if (options.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(options.dateFrom)) {
    query = query.gte("created_at", options.dateFrom + "T00:00:00.000Z");
  }
  if (options.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(options.dateTo)) {
    const next = new Date(options.dateTo + "T00:00:00.000Z");
    next.setUTCDate(next.getUTCDate() + 1);
    query = query.lt("created_at", next.toISOString());
  }

  switch (options.sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "total_high":
      query = query.order("total", { ascending: false }).order("created_at", { ascending: false });
      break;
    case "total_low":
      query = query.order("total", { ascending: true }).order("created_at", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);
  if (error) throw new Error("Orders could not be loaded.");

  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  const itemCounts = new Map<string, number>();

  if (ids.length) {
    const { data: items, error: itemError } = await supabase
      .from("order_items")
      .select("order_id,quantity")
      .in("order_id", ids);
    if (itemError) throw new Error("Order item counts could not be loaded.");
    for (const item of items ?? []) {
      itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + Number(item.quantity ?? 0));
    }
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      orderReference: row.order_reference,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      createdAt: row.created_at,
      itemCount: itemCounts.get(row.id) ?? 0,
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      currency: row.currency,
      paymentStatus: row.payment_status,
      orderStatus: row.order_status,
    })),
    totalCount: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export interface AdminOrderDetail {
  id: string;
  orderReference: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  currency: string;
  items: Array<{
    id: string;
    productId: string | null;
    planId: string | null;
    productNameSnapshot: string;
    planNameSnapshot: string | null;
    quantity: number;
    unitPrice: number | string;
    lineTotal: number | string;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    status: string;
    method: string;
    amount: number | string;
    currency: string;
    reference: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }>;
  paymentProofs: Array<{
    id: string;
    paymentId: string;
    originalFilename: string | null;
    mimeType: string | null;
    fileSizeBytes: number | null;
    verificationStatus: string;
    verifiedAt: string | null;
    createdAt: string;
    signedUrl: string | null;
  }>;
  digitalEntitlements: Array<{
    id: string;
    orderItemId: string;
    accessStatus: string;
    customerAccessUrl: string | null;
    fulfilledAt: string | null;
    expiresAt: string | null;
    assetCount: number;
  }>;
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  await requireStaff();
  if (!isUuid(orderId)) return null;
  const supabase = await createClient();

  const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: payments, error: paymentsError }, { data: entitlements, error: entitlementError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id,order_reference,user_id,customer_name,customer_email,customer_phone,created_at,updated_at,order_status,payment_status,payment_method,subtotal,discount,total,currency")
        .eq("id", orderId)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("id,order_id,product_id,plan_id,product_name_snapshot,plan_name_snapshot,quantity,unit_price,line_total,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("payments")
        .select("id,payment_status,payment_method,amount,currency,external_reference,verified_at,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("digital_entitlements")
        .select("id,order_item_id,access_status,customer_access_url,fulfilled_at,expires_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);



  if (orderError || itemsError || paymentsError || entitlementError) {
    throw new Error("The order details could not be loaded.");
  }
  if (!order) return null;

  const paymentIds = (payments ?? []).map((payment) => payment.id);
  const { data: proofRows, error: proofError } = paymentIds.length
    ? await supabase
        .from("payment_proofs")
        .select("id,payment_id,original_filename,mime_type,file_size_bytes,verification_status,verified_at,created_at,storage_path")
        .in("payment_id", paymentIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (proofError) {
    throw new Error("The payment proof metadata could not be loaded.");
  }

  const proofPaths = (proofRows ?? []).map((proof) => proof.storage_path);
  const { data: signedProofs } = proofPaths.length
    ? await supabase.storage
        .from("payment-proofs")
        .createSignedUrls(proofPaths, 10 * 60)
    : { data: [] };

  const signedProofByPath = new Map(
    ((signedProofs ?? []) as Array<{ path?: string; signedUrl?: string }>)
      .filter(
        (item): item is { path: string; signedUrl: string } =>
          typeof item.path === "string" && typeof item.signedUrl === "string",
      )
      .map((item) => [item.path, item.signedUrl]),
  );

  const paymentProofs = (proofRows ?? []).map((proof) => ({
    id: proof.id,
    paymentId: proof.payment_id,
    originalFilename: proof.original_filename,
    mimeType: proof.mime_type,
    fileSizeBytes: proof.file_size_bytes,
    verificationStatus: proof.verification_status,
    verifiedAt: proof.verified_at,
    createdAt: proof.created_at,
    signedUrl: signedProofByPath.get(proof.storage_path) ?? null,
  }));

  const entitlementIds = (entitlements ?? []).map((entry) => entry.id);
  const assetCounts = new Map<string, number>();

  if (entitlementIds.length) {
    const { data: links } = await supabase
      .from("digital_entitlement_assets")
      .select("entitlement_id")
      .in("entitlement_id", entitlementIds);
    for (const link of links ?? []) {
      assetCounts.set(link.entitlement_id, (assetCounts.get(link.entitlement_id) ?? 0) + 1);
    }
  }

  return {
    id: order.id,
    orderReference: order.order_reference,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    customerUserId: order.user_id,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    currency: order.currency,
    items: (items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      planId: item.plan_id,
      productNameSnapshot: item.product_name_snapshot,
      planNameSnapshot: item.plan_name_snapshot,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      createdAt: item.created_at,
    })),
    payments: (payments ?? []).map((payment) => ({
      id: payment.id,
      status: payment.payment_status,
      method: payment.payment_method,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.external_reference,
      verifiedAt: payment.verified_at,
      createdAt: payment.created_at,
    })),
    paymentProofs,
    digitalEntitlements: (entitlements ?? []).map((entry) => ({
      id: entry.id,
      orderItemId: entry.order_item_id,
      accessStatus: entry.access_status,
      customerAccessUrl: entry.customer_access_url,
      fulfilledAt: entry.fulfilled_at,
      expiresAt: entry.expires_at,
      assetCount: assetCounts.get(entry.id) ?? 0,
    })),
  };
}

function parseRpcPage(value: unknown): { items: unknown[]; totalCount: number; page: number; pageSize: number; pageCount: number } {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    items: Array.isArray(record.items) ? record.items : [],
    totalCount: Number(record.totalCount ?? 0),
    page: Number(record.page ?? 1),
    pageSize: Number(record.pageSize ?? 20),
    pageCount: Number(record.pageCount ?? 1),
  };
}

export async function getAdminPayments(options: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_payments", {
    p_search: options.search ?? "",
    p_status: options.status ?? "all",
    p_page: options.page ?? 1,
    p_page_size: options.pageSize ?? 20,
  });
  if (error) throw new Error("Payment records could not be loaded.");
  const page = parseRpcPage(data);
  return page as {
    items: Array<Record<string, unknown>>;
    totalCount: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export async function getAdminCustomers(options: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_customers", {
    p_search: options.search ?? "",
    p_page: options.page ?? 1,
    p_page_size: options.pageSize ?? 20,
  });
  if (error) throw new Error("Customer records could not be loaded.");
  const page = parseRpcPage(data);
  return page as {
    items: Array<Record<string, unknown>>;
    totalCount: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export async function getAdminCustomerDetail(userId: string) {
  await requireStaff();
  if (!isUuid(userId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_customer_detail", {
    p_user_id: userId,
  });
  if (error) throw new Error("The customer record could not be loaded.");
  return (data && typeof data === "object" && !Array.isArray(data) ? data : null) as Record<string, unknown> | null;
}

export async function getAdminEmailActivity(options: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_email_activity", {
    p_search: options.search ?? "",
    p_status: options.status ?? "all",
    p_page: options.page ?? 1,
    p_page_size: options.pageSize ?? 25,
  });
  if (error) throw new Error("Email activity could not be loaded.");
  return parseRpcPage(data);
}

export async function getAdminDigitalQueue(options: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_digital_queue", {
    p_search: options.search ?? "",
    p_status: options.status ?? "all",
    p_page: options.page ?? 1,
    p_page_size: options.pageSize ?? 20,
  });
  if (error) throw new Error("Digital fulfillment data could not be loaded.");
  return parseRpcPage(data);
}

export async function getAdminPaymentProofUrls(proofIds: string[]) {
  await requireStaff();
  const safeIds = proofIds.filter(isUuid);
  if (!safeIds.length) return new Map<string, string>();

  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_proofs")
    .select("id,storage_path")
    .in("id", safeIds);

  const proofRows = data ?? [];
  const paths = proofRows.map((proof) => proof.storage_path);
  if (!paths.length) return new Map<string, string>();

  const { data: signedProofs } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrls(paths, 10 * 60);

  const signedProofByPath = new Map(
    ((signedProofs ?? []) as Array<{ path?: string; signedUrl?: string }>)
      .filter(
        (item): item is { path: string; signedUrl: string } =>
          typeof item.path === "string" && typeof item.signedUrl === "string",
      )
      .map((item) => [item.path, item.signedUrl]),
  );

  return new Map(
    proofRows.flatMap((proof) => {
      const signedUrl = signedProofByPath.get(proof.storage_path);
      return signedUrl ? [[proof.id, signedUrl] as const] : [];
    }),
  );
}
