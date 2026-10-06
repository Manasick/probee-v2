import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "./auth";
import { sanitizeSearchTerm } from "./validation";
import type {
  AdminProductInput,
  AdminProductListItem,
  AdminProductMedia,
  CatalogCategory,
} from "@/lib/catalog/types";

export interface AdminProductListResult {
  items: AdminProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AdminProductEditorData {
  product: AdminProductInput | null;
  categories: CatalogCategory[];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      typeof item === "string"
        ? item
        : item == null
          ? ""
          : JSON.stringify(item),
    ]),
  );
}

function nullableInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asProductInput(product: Record<string, unknown>): AdminProductInput {
  const rawWarrantyDuration = nullableInteger(product.warranty_duration);
  const rawWarrantyUnit =
    typeof product.warranty_unit === "string"
      ? product.warranty_unit
      : "";

  return {
    id: String(product.id),
    name: String(product.name ?? ""),
    slug: String(product.slug ?? ""),
    productType:
      product.product_type === "license" || product.product_type === "subscription"
        ? product.product_type
        : "digital",
    shortDescription: String(product.short_description ?? ""),
    fullDescription: String(product.full_description ?? ""),
    active: Boolean(product.is_active),
    published: Boolean(product.is_published),
    featured: Boolean(product.is_featured),
    sortOrder: Number(product.sort_order ?? 0),
    categoryIds: [],
    warrantyDuration: rawWarrantyDuration,
    warrantyUnit:
      rawWarrantyDuration && rawWarrantyUnit
        ? (rawWarrantyUnit as AdminProductInput["warrantyUnit"])
        : "",
    deliveryType: String(product.delivery_type ?? ""),
    deliveryDetails: String(product.delivery_details ?? ""),
    requiresCustomerEmail: Boolean(product.requires_customer_email),
    customerRequirements: stringArray(product.customer_requirements),
    customAttributes: stringRecord(product.custom_attributes),
    seoTitle: String(product.seo_title ?? ""),
    seoDescription: String(product.seo_description ?? ""),
    seoKeywords: stringArray(product.seo_keywords),
    features: [],
    packageInclusions: [],
    plans: [],
    media: [],
  };
}

function friendlyReadError(): Error {
  return new Error(
    "The catalog could not be loaded right now. Please try again.",
  );
}

function mediaMimeType(storagePath: string): string {
  const extension = storagePath.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/*";
}

async function mapAdminMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Array<{
    id: string;
    media_url: string;
    media_type: string;
    alt_text: string | null;
    title: string | null;
    caption: string | null;
    sort_order: number;
    is_primary: boolean;
    is_active: boolean;
  }>,
): Promise<AdminProductMedia[]> {
  return Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.storage
        .from("product-media")
        .createSignedUrl(row.media_url, 60 * 60 * 24);

      return {
        id: row.id,
        url: data?.signedUrl ?? "",
        storagePath: row.media_url,
        alt: row.alt_text ?? "",
        title: row.title ?? "",
        caption: row.caption ?? "",
        kind: row.media_type as AdminProductMedia["kind"],
        sortOrder: row.sort_order,
        isPrimary: row.is_primary,
        active: row.is_active,
        mimeType: mediaMimeType(row.media_url),
      };
    }),
  );
}

export async function getAdminCategories(): Promise<CatalogCategory[]> {
  const { user } = await requireStaff();
  void user;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id,name,slug,description,cover_url,is_active,sort_order,seo_title,seo_description",
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw friendlyReadError();
  }

  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? undefined,
    coverUrl: category.cover_url ?? undefined,
    active: category.is_active,
    sortOrder: category.sort_order,
    seoTitle: category.seo_title ?? undefined,
    seoDescription: category.seo_description ?? undefined,
  }));
}

export async function getAdminProductList({
  search = "",
  published = "all",
  active = "all",
  featured = "all",
  page = 1,
  pageSize = 12,
}: {
  search?: string;
  published?: "all" | "true" | "false";
  active?: "all" | "true" | "false";
  featured?: "all" | "true" | "false";
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminProductListResult> {
  await requireStaff();

  const supabase = await createClient();
  const safePageSize = Math.min(Math.max(pageSize, 6), 24);
  const safePage = Math.max(page, 1);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("products")
    .select(
      "id,name,slug,product_type,is_active,is_published,is_featured,sort_order,updated_at",
      { count: "exact" },
    )
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .range(from, to);

  const safeSearch = sanitizeSearchTerm(search);

  if (safeSearch) {
    query = query.or(
      "name.ilike.%" + safeSearch + "%,slug.ilike.%" + safeSearch + "%",
    );
  }

  if (published !== "all") {
    query = query.eq("is_published", published === "true");
  }

  if (active !== "all") {
    query = query.eq("is_active", active === "true");
  }

  if (featured !== "all") {
    query = query.eq("is_featured", featured === "true");
  }

  const { data: products, error, count } = await query;

  if (error) {
    throw friendlyReadError();
  }

  const rows = products ?? [];
  const productIds = rows.map((product) => product.id);

  if (productIds.length === 0) {
    return {
      items: [],
      total: count ?? 0,
      page: safePage,
      pageSize: safePageSize,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / safePageSize)),
    };
  }

  const [{ data: categoryLinks, error: categoryError }, { data: plans, error: planError }] =
    await Promise.all([
      supabase
        .from("product_categories")
        .select("product_id,category:categories(id,name,slug)")
        .in("product_id", productIds),
      supabase
        .from("product_plans")
        .select("product_id,price,currency,is_active")
        .in("product_id", productIds),
    ]);

  if (categoryError || planError) {
    throw friendlyReadError();
  }

  const categoryMap = new Map<string, AdminProductListItem["categories"]>();
  for (const link of categoryLinks ?? []) {
    const category = Array.isArray(link.category)
      ? link.category[0]
      : link.category;

    if (!category) {
      continue;
    }

    const list = categoryMap.get(link.product_id) ?? [];
    list.push({
      id: category.id,
      name: category.name,
      slug: category.slug,
    });
    categoryMap.set(link.product_id, list);
  }

  const planMap = new Map<
    string,
    { count: number; activePrices: Array<{ price: number; currency: string }> }
  >();

  for (const plan of plans ?? []) {
    const entry = planMap.get(plan.product_id) ?? {
      count: 0,
      activePrices: [],
    };

    entry.count += 1;

    if (plan.is_active) {
      const price = Number(plan.price);
      if (Number.isFinite(price) && price >= 0 && plan.currency) {
        entry.activePrices.push({ price, currency: plan.currency });
      }
    }

    planMap.set(plan.product_id, entry);
  }

  const items = rows.map((product) => {
    const planData = planMap.get(product.id);
    const activePrices = planData?.activePrices ?? [];
    const currencies = new Set(activePrices.map((plan) => plan.currency));

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      productType: product.product_type,
      active: product.is_active,
      published: product.is_published,
      featured: product.is_featured,
      sortOrder: product.sort_order,
      updatedAt: product.updated_at,
      categories: categoryMap.get(product.id) ?? [],
      planCount: planData?.count ?? 0,
      priceRange:
        activePrices.length > 0 && currencies.size === 1
          ? {
              min: Math.min(...activePrices.map((plan) => plan.price)),
              max: Math.max(...activePrices.map((plan) => plan.price)),
              currency: activePrices[0].currency,
            }
          : null,
    } satisfies AdminProductListItem;
  });

  return {
    items,
    total: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / safePageSize)),
  };
}

export async function getAdminProductEditorData(
  productId?: string,
): Promise<AdminProductEditorData> {
  await requireStaff();

  const supabase = await createClient();
  const categories = await getAdminCategories();

  if (!productId) {
    return { product: null, categories };
  }

  const [
    { data: product, error: productError },
    { data: categoryLinks, error: categoryError },
    { data: featureRows, error: featureError },
    { data: inclusionRows, error: inclusionError },
    { data: planRows, error: planError },
    { data: mediaRows, error: mediaError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,name,slug,product_type,short_description,full_description,is_active,is_published,is_featured,sort_order,warranty_duration,warranty_unit,delivery_type,delivery_details,requires_customer_email,customer_requirements,custom_attributes,seo_title,seo_description,seo_keywords",
      )
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("product_categories")
      .select("category_id")
      .eq("product_id", productId),
    supabase
      .from("product_features")
      .select("id,feature_text,is_active,sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_package_inclusions")
      .select("id,inclusion_text,is_active,sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_plans")
      .select(
        "id,name,slug,description,billing_type,billing_interval,billing_interval_count,price,currency,duration,duration_unit,renewal_available,warranty_duration,warranty_unit,seats,invites,participants,features,delivery_type,delivery_details,requires_customer_email,customer_requirements,custom_attributes,is_active,sort_order",
      )
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_media")
      .select(
        "id,media_url,media_type,alt_text,title,caption,sort_order,is_primary,is_active",
      )
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (
    productError ||
    categoryError ||
    featureError ||
    inclusionError ||
    planError ||
    mediaError
  ) {
    throw friendlyReadError();
  }

  if (!product) {
    return { product: null, categories };
  }

  const input = asProductInput(product as Record<string, unknown>);
  input.categoryIds = (categoryLinks ?? []).map((row) => row.category_id);

  input.features = (featureRows ?? []).map((row) => ({
    id: row.id,
    text: row.feature_text,
    active: row.is_active,
    sortOrder: row.sort_order,
  }));

  input.packageInclusions = (inclusionRows ?? []).map((row) => ({
    id: row.id,
    text: row.inclusion_text,
    active: row.is_active,
    sortOrder: row.sort_order,
  }));

  input.media = await mapAdminMedia(supabase, mediaRows ?? []);

  input.plans = (planRows ?? []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? "",
    billingType:
      plan.billing_type === "subscription" ? "subscription" : "one_time",
    billingInterval:
      plan.billing_interval === "day" ||
      plan.billing_interval === "week" ||
      plan.billing_interval === "month" ||
      plan.billing_interval === "year"
        ? plan.billing_interval
        : "",
    billingIntervalCount: nullableInteger(plan.billing_interval_count),
    price: Number(plan.price),
    currency: plan.currency,
    duration: nullableInteger(plan.duration),
    durationUnit:
      typeof plan.duration_unit === "string"
        ? (plan.duration_unit as AdminProductInput["warrantyUnit"])
        : "",
    renewalAvailable: Boolean(plan.renewal_available),
    warrantyDuration: nullableInteger(plan.warranty_duration),
    warrantyUnit:
      typeof plan.warranty_unit === "string"
        ? (plan.warranty_unit as AdminProductInput["warrantyUnit"])
        : "",
    seats: nullableInteger(plan.seats),
    invites: nullableInteger(plan.invites),
    participants: nullableInteger(plan.participants),
    features: stringArray(plan.features),
    deliveryType: plan.delivery_type ?? "",
    deliveryDetails: plan.delivery_details ?? "",
    requiresCustomerEmail: Boolean(plan.requires_customer_email),
    customerRequirements: stringArray(plan.customer_requirements),
    customAttributes: stringRecord(plan.custom_attributes),
    active: Boolean(plan.is_active),
    sortOrder: Number(plan.sort_order ?? 0),
  }));

  return { product: input, categories };
}
