"use server";

import { revalidatePath } from "next/cache";
import type {
  AdminProductInput,
  AdminProductPlanInput,
} from "@/lib/catalog/types";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import {
  isUuid,
  validateAdminProductInput,
} from "@/lib/admin/validation";

export interface ProductActionState {
  ok: boolean;
  message: string;
  field?: string;
  productId?: string;
}

const EMPTY_STATE: ProductActionState = {
  ok: false,
  message: "",
};

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseProductPayload(formData: FormData):
  | { input: AdminProductInput }
  | { error: string } {
  const raw = formData.get("payload");

  if (typeof raw !== "string" || raw.length > 500_000) {
    return { error: "The product form data is invalid." };
  }

  try {
    const input = JSON.parse(raw) as AdminProductInput;

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { error: "The product form data is invalid." };
    }

    return { input };
  } catch {
    return { error: "The product form data could not be read." };
  }
}

function mapDatabaseError(error: {
  code?: string | null;
  message?: string | null;
}): string {
  if (error.code === "23505") {
    if (error.message?.includes("products_slug_key")) {
      return "That product slug is already in use.";
    }

    if (error.message?.includes("product_plans_product_id_slug_key")) {
      return "A plan with that slug already exists for this product.";
    }

    return "A catalog record with the same unique value already exists.";
  }

  if (error.code === "23514") {
    return "One of the values does not satisfy the catalog validation rules.";
  }

  if (error.code === "23503") {
    return "A referenced catalog record no longer exists.";
  }

  if (error.code === "42501") {
    return "You are not authorized to manage catalog records.";
  }

  return "The catalog could not be saved right now. Please try again.";
}

async function ensureCategoryIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryIds: string[],
): Promise<string | null> {
  const ids = uniqueIds(categoryIds);

  if (ids.some((id) => !isUuid(id))) {
    return "One or more selected categories are invalid.";
  }

  if (ids.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .in("id", ids);

  if (error) {
    return "The selected categories could not be verified.";
  }

  if ((data ?? []).length !== ids.length) {
    return "One or more selected categories could not be found.";
  }

  return null;
}

async function ensureUniqueProductSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
  productId?: string,
): Promise<string | null> {
  let query = supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .limit(1);

  if (productId) {
    query = query.neq("id", productId);
  }

  const { data, error } = await query;

  if (error) {
    return "The product slug could not be checked.";
  }

  return data && data.length > 0
    ? "That product slug is already in use."
    : null;
}

async function syncCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  categoryIds: string[],
): Promise<ProductActionState | null> {
  const deleteResult = await supabase
    .from("product_categories")
    .delete()
    .eq("product_id", productId);

  if (deleteResult.error) {
    return {
      ok: false,
      message: mapDatabaseError(deleteResult.error),
    };
  }

  const ids = uniqueIds(categoryIds);

  if (ids.length === 0) {
    return null;
  }

  const { error } = await supabase.from("product_categories").insert(
    ids.map((categoryId) => ({
      product_id: productId,
      category_id: categoryId,
    })),
  );

  if (error) {
    return {
      ok: false,
      message: mapDatabaseError(error),
    };
  }

  return null;
}

async function syncTextChildTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  table: "product_features" | "product_package_inclusions",
  rows: AdminProductInput["features"],
): Promise<ProductActionState | null> {
  const { data: existingRows, error: existingError } = await supabase
    .from(table)
    .select("id")
    .eq("product_id", productId);

  if (existingError) {
    return {
      ok: false,
      message: mapDatabaseError(existingError),
    };
  }

  const existingIds = new Set((existingRows ?? []).map((row) => row.id));
  const incomingIds = new Set(
    rows.filter((row) => row.id).map((row) => row.id as string),
  );

  const invalidIncomingId = [...incomingIds].some(
    (id) => !existingIds.has(id),
  );

  if (invalidIncomingId) {
    return {
      ok: false,
      message: "The product content contains an invalid item reference.",
    };
  }

  const missingIds = [...existingIds].filter((id) => !incomingIds.has(id));

  if (missingIds.length > 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("product_id", productId)
      .in("id", missingIds);

    if (error) {
      return {
        ok: false,
        message: mapDatabaseError(error),
      };
    }
  }

  const payload = rows.map((row, index) =>
    table === "product_features"
      ? {
          ...(row.id ? { id: row.id } : {}),
          product_id: productId,
          feature_text: row.text.trim(),
          is_active: row.active,
          sort_order: index,
        }
      : {
          ...(row.id ? { id: row.id } : {}),
          product_id: productId,
          inclusion_text: row.text.trim(),
          is_active: row.active,
          sort_order: index,
        },
  );

  if (payload.length === 0) {
    return null;
  }

  const { error } = await supabase.from(table).upsert(payload);

  if (error) {
    return {
      ok: false,
      message: mapDatabaseError(error),
    };
  }

  return null;
}

async function syncPlans(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  plans: AdminProductPlanInput[],
): Promise<ProductActionState | null> {
  const { data: existingRows, error: existingError } = await supabase
    .from("product_plans")
    .select("id")
    .eq("product_id", productId);

  if (existingError) {
    return {
      ok: false,
      message: mapDatabaseError(existingError),
    };
  }

  const existingIds = new Set((existingRows ?? []).map((row) => row.id));
  const incomingIds = new Set(
    plans.filter((plan) => plan.id).map((plan) => plan.id as string),
  );

  const invalidIncomingId = [...incomingIds].some(
    (id) => !existingIds.has(id),
  );

  if (invalidIncomingId) {
    return {
      ok: false,
      message: "The plan data contains an invalid item reference.",
    };
  }

  const missingIds = [...existingIds].filter((id) => !incomingIds.has(id));

  if (missingIds.length > 0) {
    const { error } = await supabase
      .from("product_plans")
      .delete()
      .eq("product_id", productId)
      .in("id", missingIds);

    if (error) {
      return {
        ok: false,
        message: mapDatabaseError(error),
      };
    }
  }

  const payload = plans.map((plan, index) => ({
    ...(plan.id ? { id: plan.id } : {}),
    product_id: productId,
    name: plan.name.trim(),
    slug: plan.slug.trim(),
    description: textOrNull(plan.description),
    billing_type: plan.billingType,
    billing_interval:
      plan.billingType === "subscription"
        ? plan.billingInterval || null
        : null,
    billing_interval_count:
      plan.billingType === "subscription"
        ? plan.billingIntervalCount
        : null,
    price: plan.price,
    currency: plan.currency,
    duration: plan.duration,
    duration_unit: plan.duration ? plan.durationUnit : null,
    renewal_available: plan.renewalAvailable,
    warranty_duration: plan.warrantyDuration,
    warranty_unit: plan.warrantyDuration ? plan.warrantyUnit : null,
    seats: plan.seats,
    invites: plan.invites,
    participants: plan.participants,
    features: plan.features.map((feature) => feature.trim()),
    delivery_type: textOrNull(plan.deliveryType),
    delivery_details: textOrNull(plan.deliveryDetails),
    requires_customer_email: plan.requiresCustomerEmail,
    customer_requirements: plan.customerRequirements.map((item) =>
      item.trim(),
    ),
    custom_attributes: plan.customAttributes,
    is_active: plan.active,
    sort_order: index,
  }));

  if (payload.length === 0) {
    return null;
  }

  const { error } = await supabase.from("product_plans").upsert(payload);

  if (error) {
    return {
      ok: false,
      message: mapDatabaseError(error),
    };
  }

  return null;
}

async function saveProduct(
  mode: "create" | "update",
  productId: string | undefined,
  input: AdminProductInput,
): Promise<ProductActionState> {
  const context = await requireStaff();
  void context;

  const validationError = validateAdminProductInput(input);

  if (validationError) {
    return { ...EMPTY_STATE, message: validationError };
  }

  if (
    mode === "update" &&
    (!productId || !isUuid(productId) || input.id !== productId)
  ) {
    return { ...EMPTY_STATE, message: "The product reference is invalid." };
  }

  const supabase = await createClient();

  const categoryError = await ensureCategoryIds(
    supabase,
    input.categoryIds,
  );

  if (categoryError) {
    return { ...EMPTY_STATE, message: categoryError };
  }

  const slugError = await ensureUniqueProductSlug(
    supabase,
    input.slug,
    productId,
  );

  if (slugError) {
    return { ...EMPTY_STATE, message: slugError };
  }

  let oldSlug: string | null = null;

  if (mode === "update" && productId) {
    const { data: currentProduct, error: currentError } = await supabase
      .from("products")
      .select("id,slug")
      .eq("id", productId)
      .maybeSingle();

    if (currentError) {
      return {
        ...EMPTY_STATE,
        message: mapDatabaseError(currentError),
      };
    }

    if (!currentProduct) {
      return { ...EMPTY_STATE, message: "The product could not be found." };
    }

    oldSlug = currentProduct.slug;
  }

  const values = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    short_description: textOrNull(input.shortDescription),
    full_description: textOrNull(input.fullDescription),
    product_type: input.productType,
    is_active: input.active,
    is_published: input.published,
    is_featured: input.featured,
    sort_order: input.sortOrder,
    warranty_duration: input.warrantyDuration,
    warranty_unit: input.warrantyDuration ? input.warrantyUnit : null,
    delivery_type: textOrNull(input.deliveryType),
    delivery_details: textOrNull(input.deliveryDetails),
    requires_customer_email: input.requiresCustomerEmail,
    customer_requirements: input.customerRequirements.map((item) =>
      item.trim(),
    ),
    custom_attributes: input.customAttributes,
    seo_title: textOrNull(input.seoTitle),
    seo_description: textOrNull(input.seoDescription),
    seo_keywords: input.seoKeywords.map((keyword) => keyword.trim()).filter(Boolean),
  };

  let savedProductId = productId;

  if (mode === "create") {
    const { data, error } = await supabase
      .from("products")
      .insert(values)
      .select("id,slug")
      .single();

    if (error || !data) {
      return {
        ...EMPTY_STATE,
        message: error
          ? mapDatabaseError(error)
          : "The product could not be created.",
      };
    }

    savedProductId = data.id;
  } else {
    const { error } = await supabase
      .from("products")
      .update(values)
      .eq("id", productId);

    if (error) {
      return {
        ...EMPTY_STATE,
        message: mapDatabaseError(error),
      };
    }
  }

  if (!savedProductId) {
    return {
      ...EMPTY_STATE,
      message: "The product could not be saved.",
    };
  }

  const categoryResult = await syncCategories(
    supabase,
    savedProductId,
    input.categoryIds,
  );

  if (categoryResult) {
    return categoryResult;
  }

  const featureResult = await syncTextChildTable(
    supabase,
    savedProductId,
    "product_features",
    input.features,
  );

  if (featureResult) {
    return featureResult;
  }

  const inclusionResult = await syncTextChildTable(
    supabase,
    savedProductId,
    "product_package_inclusions",
    input.packageInclusions,
  );

  if (inclusionResult) {
    return inclusionResult;
  }

  const planResult = await syncPlans(
    supabase,
    savedProductId,
    input.plans,
  );

  if (planResult) {
    return planResult;
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/admin/products/" + savedProductId);
  revalidatePath("/products");
  revalidatePath("/products/" + input.slug);

  if (oldSlug && oldSlug !== input.slug) {
    revalidatePath("/products/" + oldSlug);
  }

  return {
    ok: true,
    message: mode === "create" ? "Product created." : "Product saved.",
    productId: savedProductId,
  };
}

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const parsed = parseProductPayload(formData);

  if ("error" in parsed) {
    return { ...EMPTY_STATE, message: parsed.error };
  }

  return saveProduct("create", undefined, parsed.input);
}

export async function updateProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const productId = formData.get("productId");

  if (typeof productId !== "string" || !productId) {
    return { ...EMPTY_STATE, message: "The product reference is missing." };
  }

  const parsed = parseProductPayload(formData);

  if ("error" in parsed) {
    return { ...EMPTY_STATE, message: parsed.error };
  }

  return saveProduct("update", productId, parsed.input);
}
