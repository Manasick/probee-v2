import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "./format";
import type {
  CatalogCategory,
  CatalogProduct,
  ProductMedia,
  ProductPlan,
} from "./types";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  cover_url: string | null;
  product_type: string;
  is_active: boolean;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  warranty_duration: number | null;
  warranty_unit: string | null;
  delivery_type: string | null;
  delivery_details: string | null;
  requires_customer_email: boolean;
  customer_requirements: unknown;
  custom_attributes: unknown;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapCategory(row: {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  cover_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
  seo_title?: string | null;
  seo_description?: string | null;
}): CatalogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    active: row.is_active,
    sortOrder: row.sort_order,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
  };
}

async function signMedia(
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
  }>,
): Promise<ProductMedia[]> {
  const sortedRows = [...rows].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      Number(b.is_primary) - Number(a.is_primary),
  );

  const results = await Promise.all(
    sortedRows.map(async (row) => {
      const { data } = await supabase.storage
        .from("product-media")
        .createSignedUrl(row.media_url, 60 * 60 * 24);

      if (!data?.signedUrl) {
        return null;
      }

      return {
        id: row.id,
        url: data.signedUrl,
        storagePath: row.media_url,
        alt: row.alt_text ?? undefined,
        title: row.title ?? undefined,
        caption: row.caption ?? undefined,
        kind: row.media_type as ProductMedia["kind"],
        sortOrder: row.sort_order,
        isPrimary: row.is_primary,
        active: true,
      } satisfies ProductMedia;
    }),
  );

  return results.filter((item): item is ProductMedia => Boolean(item));
}

function mapPlan(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  billing_type: string;
  billing_interval: string | null;
  billing_interval_count: number | null;
  price: number | string;
  currency: string;
  duration: number | null;
  duration_unit: string | null;
  renewal_available: boolean;
  warranty_duration: number | null;
  warranty_unit: string | null;
  seats: number | null;
  invites: number | null;
  participants: number | null;
  features: unknown;
  delivery_type: string | null;
  delivery_details: string | null;
  requires_customer_email: boolean;
  customer_requirements: unknown;
  custom_attributes: unknown;
  is_active: boolean;
  sort_order: number;
}): ProductPlan {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    billingType: row.billing_type,
    billingInterval: row.billing_interval ?? undefined,
    billingIntervalCount: row.billing_interval_count ?? undefined,
    price: Number(row.price),
    currency: row.currency,
    duration: row.duration ?? undefined,
    durationUnit: row.duration_unit ?? undefined,
    renewalAvailable: row.renewal_available,
    warrantyPeriod: row.warranty_duration ?? undefined,
    warrantyUnit: row.warranty_unit ?? undefined,
    seats: row.seats ?? undefined,
    invites: row.invites ?? undefined,
    participants: row.participants ?? undefined,
    features: stringArray(row.features),
    deliveryType: row.delivery_type ?? undefined,
    deliveryDetails: row.delivery_details ?? undefined,
    requiresCustomerEmail: row.requires_customer_email,
    customerRequirements: stringArray(row.customer_requirements),
    customAttributes: objectValue(row.custom_attributes),
    active: row.is_active,
    sortOrder: row.sort_order,
  };
}

function mapBaseProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description ?? undefined,
    fullDescription: row.full_description ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    productType: row.product_type,
    active: row.is_active,
    published: row.is_published,
    featured: row.is_featured,
    sortOrder: row.sort_order,
    warrantyPeriod: row.warranty_duration ?? undefined,
    warrantyUnit: row.warranty_unit ?? undefined,
    delivery:
      row.delivery_type || row.delivery_details
        ? {
            type: row.delivery_type ?? undefined,
            description: row.delivery_details ?? undefined,
            label: row.delivery_type ?? undefined,
          }
        : undefined,
    requiresCustomerEmail: row.requires_customer_email,
    customerRequirements: stringArray(row.customer_requirements),
    seo: {
      title: row.seo_title ?? undefined,
      description: row.seo_description ?? undefined,
      keywords: row.seo_keywords ?? undefined,
    },
    plans: [],
    features: [],
    packageInclusions: [],
    media: [],
    customAttributes: objectValue(row.custom_attributes),
  };
}

async function buildProductMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  products: ProductRow[],
  includeMedia = false,
): Promise<CatalogProduct[]> {
  if (products.length === 0) {
    return [];
  }

  const ids = products.map((product) => product.id);

  const [
    { data: categoryLinks, error: categoryError },
    { data: planRows, error: planError },
    { data: mediaRows, error: mediaError },
  ] = await Promise.all([
    supabase
      .from("product_categories")
      .select(
        "product_id,category:categories(id,name,slug,description,cover_url,is_active,sort_order,seo_title,seo_description)",
      )
      .in("product_id", ids),
    supabase
      .from("product_plans")
      .select(
        "id,product_id,name,slug,description,billing_type,billing_interval,billing_interval_count,price,currency,duration,duration_unit,renewal_available,warranty_duration,warranty_unit,seats,invites,participants,features,delivery_type,delivery_details,requires_customer_email,customer_requirements,custom_attributes,is_active,sort_order",
      )
      .in("product_id", ids)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_media")
      .select(
        "id,product_id,media_url,media_type,alt_text,title,caption,sort_order,is_primary,is_active",
      )
      .in("product_id", ids)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (categoryError || planError || mediaError) {
    return [];
  }

  const categoryMap = new Map<string, CatalogCategory>();
  for (const link of categoryLinks ?? []) {
    const category = Array.isArray(link.category)
      ? link.category[0]
      : link.category;

    if (category && !categoryMap.has(link.product_id)) {
      categoryMap.set(link.product_id, mapCategory(category));
    }
  }

  const planMap = new Map<string, ProductPlan[]>();
  for (const row of planRows ?? []) {
    if (!row.is_active) continue;
    const list = planMap.get(row.product_id) ?? [];
    list.push(mapPlan(row));
    planMap.set(row.product_id, list);
  }

  const mediaMap = new Map<string, typeof mediaRows>();
  for (const row of mediaRows ?? []) {
    if (!row.is_active) continue;
    const list = mediaMap.get(row.product_id) ?? [];
    list.push(row);
    mediaMap.set(row.product_id, list);
  }

  const primaryPaths = Array.from(
    new Set(
      products
        .map((product) => {
          const rows = mediaMap.get(product.id) ?? [];
          const primary = rows.find((row) => row.is_primary) ?? rows[0];
          return primary?.media_url;
        })
        .filter((path): path is string => Boolean(path)),
    ),
  );

  const signedPrimaryEntries = includeMedia
    ? []
    : await Promise.all(
        primaryPaths.map(async (path) => {
          const { data } = await supabase.storage
            .from("product-media")
            .createSignedUrl(path, 60 * 60 * 24);

          return [path, data?.signedUrl ?? null] as const;
        }),
      );

  const signedPrimaryMap = new Map(
    signedPrimaryEntries.filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  );

  return products.map((row) => {
    const product = mapBaseProduct(row);
    const media = mediaMap.get(row.id) ?? [];
    const firstMedia = media.find((item) => item.is_primary) ?? media[0];

    product.category = categoryMap.get(row.id);
    product.plans = planMap.get(row.id) ?? [];

    if (includeMedia) {
      product.media = await signMedia(supabase, media);
      product.coverUrl =
        product.media.find((item) => item.isPrimary)?.url ??
        product.media[0]?.url ??
        row.cover_url ??
        undefined;
    } else {
      product.coverUrl =
        signedPrimaryMap.get(firstMedia?.media_url ?? "") ??
        row.cover_url ??
        undefined;
    }

    return product;
  });
}

export async function getPublicCatalogCategories(): Promise<CatalogCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id,name,slug,description,cover_url,is_active,sort_order,seo_title,seo_description",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return (data ?? []).map(mapCategory);
}

export async function getPublicCatalogProducts(
  limit = 24,
): Promise<CatalogProduct[]> {
  const supabase = await createClient();
  const safeLimit = Math.min(Math.max(limit, 1), 48);

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,slug,short_description,full_description,cover_url,product_type,is_active,is_published,is_featured,sort_order,warranty_duration,warranty_unit,delivery_type,delivery_details,requires_customer_email,customer_requirements,custom_attributes,seo_title,seo_description,seo_keywords",
    )
    .eq("is_active", true)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return [];
  }

  return buildProductMap(
    supabase,
    (data ?? []) as ProductRow[],
  );
}

export async function getPublicCatalogProductsByIds(
  productIds: string[],
): Promise<CatalogProduct[]> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean))).slice(0, 50);

  if (uniqueIds.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,slug,short_description,full_description,cover_url,product_type,is_active,is_published,is_featured,sort_order,warranty_duration,warranty_unit,delivery_type,delivery_details,requires_customer_email,customer_requirements,custom_attributes,seo_title,seo_description,seo_keywords",
    )
    .in("id", uniqueIds)
    .eq("is_active", true)
    .eq("is_published", true);

  if (error) {
    return [];
  }

  return buildProductMap(
    supabase,
    (data ?? []) as ProductRow[],
  );
}

const getPublicCatalogProductBySlugUncached = async (
  slug: string,
): Promise<CatalogProduct | null> => {
  const supabase = await createClient();

  const { data: row, error: productError } = await supabase
    .from("products")
    .select(
      "id,name,slug,short_description,full_description,cover_url,product_type,is_active,is_published,is_featured,sort_order,warranty_duration,warranty_unit,delivery_type,delivery_details,requires_customer_email,customer_requirements,custom_attributes,seo_title,seo_description,seo_keywords",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("is_published", true)
    .maybeSingle();

  if (productError || !row) {
    return null;
  }

  const [product] = await buildProductMap(
    supabase,
    [row as ProductRow],
    true,
  );

  if (!product) {
    return null;
  }

  const [
    { data: featureRows, error: featureError },
    { data: inclusionRows, error: inclusionError },
  ] = await Promise.all([
    supabase
      .from("product_features")
      .select("feature_text")
      .eq("product_id", row.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_package_inclusions")
      .select("inclusion_text")
      .eq("product_id", row.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (featureError || inclusionError) {
    return product;
  }

  product.features = (featureRows ?? []).map((item) => item.feature_text);
  product.packageInclusions = (inclusionRows ?? []).map(
    (item) => item.inclusion_text,
  );

  return product;
};

export const getPublicCatalogProductBySlug = cache(
  getPublicCatalogProductBySlugUncached,
);

export function getCatalogPriceLabel(product: CatalogProduct): string | null {
  const activePlans = product.plans.filter(
    (plan) => plan.active !== false && Number.isFinite(plan.price),
  );

  if (activePlans.length === 0) {
    return null;
  }

  const currencies = new Set(activePlans.map((plan) => plan.currency));
  if (currencies.size !== 1) {
    return "Multiple currencies";
  }

  const amounts = activePlans.map((plan) => plan.price);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);

  return min === max
    ? formatPrice(min, activePlans[0].currency)
    : formatPrice(min, activePlans[0].currency) +
        " – " +
        formatPrice(max, activePlans[0].currency);
}
