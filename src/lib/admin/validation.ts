import type {
  AdminKeyValue,
  AdminProductInput,
  AdminProductPlanInput,
} from "@/lib/catalog/types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_PRODUCT_TYPES = new Set([
  "digital",
  "license",
  "subscription",
]);

const RESERVED_ATTRIBUTE_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function slugifyProductName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validateAdminProductInput(
  input: AdminProductInput,
): string | null {
  if (!input.name.trim()) {
    return "Product name is required.";
  }

  if (input.name.trim().length > 180) {
    return "Product name must be 180 characters or fewer.";
  }

  if (!SLUG_PATTERN.test(input.slug)) {
    return "Slug must contain lowercase letters, numbers, and single hyphens only.";
  }

  if (!ALLOWED_PRODUCT_TYPES.has(input.productType)) {
    return "Product type is invalid.";
  }

  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    return "Display order must be a whole number greater than or equal to 0.";
  }

  if (
    input.warrantyDuration !== null &&
    (!Number.isInteger(input.warrantyDuration) ||
      input.warrantyDuration <= 0 ||
      !input.warrantyUnit)
  ) {
    return "Product warranty must use a positive duration and a valid unit.";
  }

  if (input.warrantyDuration === null && input.warrantyUnit) {
    return "Product warranty unit cannot be set without a duration.";
  }

  if (!validateTextArray(input.customerRequirements)) {
    return "Customer requirements contain invalid values.";
  }

  if (!validateKeyValueObject(input.customAttributes)) {
    return "Custom attributes contain an invalid key or value.";
  }

  if (!validateTextArray(input.seoKeywords, 120)) {
    return "SEO keywords contain invalid values.";
  }

  const seenFeatureIds = new Set<string>();
  for (const item of input.features) {
    if (item.id && (seenFeatureIds.has(item.id) || !isUuid(item.id))) {
      return "Feature data is invalid.";
    }

    if (item.id) {
      seenFeatureIds.add(item.id);
    }

    if (!item.text.trim()) {
      return "Feature text cannot be empty.";
    }

    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      return "Feature display order is invalid.";
    }
  }

  const seenInclusionIds = new Set<string>();
  for (const item of input.packageInclusions) {
    if (
      item.id &&
      (seenInclusionIds.has(item.id) || !isUuid(item.id))
    ) {
      return "Package inclusion data is invalid.";
    }

    if (item.id) {
      seenInclusionIds.add(item.id);
    }

    if (!item.text.trim()) {
      return "Package inclusion text cannot be empty.";
    }

    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      return "Package inclusion display order is invalid.";
    }
  }

  const seenPlanSlugs = new Set<string>();

  for (const plan of input.plans) {
    const error = validateAdminProductPlanInput(plan);

    if (error) {
      return error;
    }

    if (seenPlanSlugs.has(plan.slug)) {
      return "Each plan must have a unique slug within this product.";
    }

    seenPlanSlugs.add(plan.slug);
  }

  return null;
}

export function validateAdminProductPlanInput(
  plan: AdminProductPlanInput,
): string | null {
  if (!plan.name.trim()) {
    return "Every plan needs a name.";
  }

  if (!SLUG_PATTERN.test(plan.slug)) {
    return 'Plan slug "' + plan.name + '" is invalid.';
  }

  if (!Number.isFinite(plan.price) || plan.price < 0) {
    return 'Plan "' + plan.name + '" has an invalid price.';
  }

  if (!CURRENCY_PATTERN.test(plan.currency)) {
    return 'Plan "' + plan.name + '" must use a valid three-letter currency code.';
  }

  if (plan.billingType === "subscription") {
    if (!plan.billingInterval) {
      return 'Plan "' + plan.name + '" needs a billing interval for subscriptions.';
    }

    if (
      plan.billingIntervalCount === null ||
      !Number.isInteger(plan.billingIntervalCount) ||
      plan.billingIntervalCount <= 0
    ) {
      return 'Plan "' + plan.name + '" needs a positive billing interval count.';
    }
  } else if (
    plan.billingInterval ||
    plan.billingIntervalCount !== null
  ) {
    return 'Plan "' + plan.name + '" cannot have subscription interval data when billing is one-time.';
  }

  if (plan.duration !== null) {
    if (!Number.isInteger(plan.duration) || plan.duration <= 0) {
      return 'Plan "' + plan.name + '" has an invalid duration.';
    }

    if (!plan.durationUnit) {
      return 'Plan "' + plan.name + '" needs a duration unit.';
    }
  } else if (plan.durationUnit) {
    return 'Plan "' + plan.name + '" cannot have a duration unit without a duration.';
  }

  if (
    plan.warrantyDuration !== null &&
    (!Number.isInteger(plan.warrantyDuration) ||
      plan.warrantyDuration <= 0 ||
      !plan.warrantyUnit)
  ) {
    return 'Plan "' + plan.name + '" has an invalid warranty.';
  }

  if (plan.warrantyDuration === null && plan.warrantyUnit) {
    return 'Plan "' + plan.name + '" cannot have a warranty unit without a duration.';
  }

  for (const [label, value] of [
    ["seats", plan.seats],
    ["invites", plan.invites],
    ["participants", plan.participants],
  ] as const) {
    if (
      value !== null &&
      (!Number.isInteger(value) || value <= 0)
    ) {
      return 'Plan "' + plan.name + '" has an invalid ' + label + ' value.';
    }
  }

  if (!validateTextArray(plan.features)) {
    return 'Plan "' + plan.name + '" has invalid features.';
  }

  if (!validateTextArray(plan.customerRequirements)) {
    return 'Plan "' + plan.name + '" has invalid customer requirements.';
  }

  if (!validateKeyValueObject(plan.customAttributes)) {
    return 'Plan "' + plan.name + '" has invalid custom attributes.';
  }

  if (!Number.isInteger(plan.sortOrder) || plan.sortOrder < 0) {
    return 'Plan "' + plan.name + '" has an invalid display order.';
  }

  return null;
}

export function validateTextArray(
  values: unknown,
  maxLength = 500,
): values is string[] {
  if (!Array.isArray(values) || values.length > 200) {
    return false;
  }

  return values.every(
    (value) =>
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= maxLength,
  );
}

export function validateKeyValueObject(
  value: unknown,
): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).every(
    ([key, item]) =>
      key.trim().length > 0 &&
      key.length <= 80 &&
      !RESERVED_ATTRIBUTE_KEYS.has(key) &&
      typeof item === "string" &&
      item.length <= 1000,
  );
}

export function normalizeKeyValueItems(
  items: AdminKeyValue[],
): Record<string, string> | null {
  const result: Record<string, string> = {};

  for (const item of items) {
    const key = item.key.trim();

    if (!key) {
      continue;
    }

    if (
      key.length > 80 ||
      RESERVED_ATTRIBUTE_KEYS.has(key) ||
      typeof item.value !== "string" ||
      item.value.length > 1000
    ) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(result, key)) {
      return null;
    }

    result[key] = item.value;
  }

  return result;
}

export function sanitizeSearchTerm(value: string): string {
  return value.replace(/[^a-zA-Z0-9\s-]/g, " ").trim().slice(0, 80);
}

export const productTypeOptions = [
  { value: "digital", label: "Digital product" },
  { value: "license", label: "License" },
  { value: "subscription", label: "Subscription" },
] as const;

export const durationUnitOptions = [
  { value: "", label: "No duration" },
  { value: "day", label: "Day(s)" },
  { value: "week", label: "Week(s)" },
  { value: "month", label: "Month(s)" },
  { value: "year", label: "Year(s)" },
  { value: "lifetime", label: "Lifetime" },
] as const;

export const billingIntervalOptions = [
  { value: "", label: "Select interval" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;
