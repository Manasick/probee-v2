"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AdminStatus } from "@/components/admin/admin-status";
import { ProductMediaManager } from "@/components/admin/product-media-manager";
import { Button, Container, Surface } from "@/components/ui";
import {
  billingIntervalOptions,
  durationUnitOptions,
  productTypeOptions,
  slugifyProductName,
} from "@/lib/admin/validation";
import type {
  AdminProductInput,
  AdminProductPlanInput,
  CatalogCategory,
} from "@/lib/catalog/types";
import type { ProductActionState } from "@/app/admin/products/actions";
import {
  createProductAction,
  updateProductAction,
} from "@/app/admin/products/actions";

const NEW_PLAN: AdminProductPlanInput = {
  name: "",
  slug: "",
  description: "",
  billingType: "one_time",
  billingInterval: "",
  billingIntervalCount: null,
  price: 0,
  currency: "USD",
  duration: null,
  durationUnit: "",
  renewalAvailable: false,
  warrantyDuration: null,
  warrantyUnit: "",
  seats: null,
  invites: null,
  participants: null,
  features: [],
  deliveryType: "",
  deliveryDetails: "",
  requiresCustomerEmail: false,
  customerRequirements: [],
  customAttributes: {},
  active: true,
  sortOrder: 0,
};

function blankProduct(): AdminProductInput {
  return {
    name: "",
    slug: "",
    productType: "digital",
    shortDescription: "",
    fullDescription: "",
    active: true,
    published: false,
    featured: false,
    sortOrder: 0,
    categoryIds: [],
    warrantyDuration: null,
    warrantyUnit: "",
    deliveryType: "",
    deliveryDetails: "",
    requiresCustomerEmail: false,
    customerRequirements: [],
    customAttributes: {},
    seoTitle: "",
    seoDescription: "",
    seoKeywords: [],
    features: [],
    packageInclusions: [],
    plans: [],
    media: [],
  };
}

function inputClassName(extra = "") {
  return [
    "min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary",
    "placeholder:text-text-muted outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]",
    extra,
  ].join(" ");
}

function labelClassName() {
  return "mb-2 block text-sm font-medium text-text-secondary";
}

function makeId(prefix: string, index: number): string {
  return prefix + "-" + index;
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface ProductEditorProps {
  initialProduct: AdminProductInput | null;
  categories: CatalogCategory[];
  mode: "create" | "edit";
}

function SaveBar() {
  const { pending } = useFormStatus();

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--probee-border-subtle)] bg-background/95 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-[80rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-muted">
          {pending
            ? "Saving catalog changes…"
            : "Server-side validation and database policies remain authoritative."}
        </p>
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : "Save product"}
        </Button>
      </div>
    </div>
  );
}

export function ProductEditor({
  initialProduct,
  categories,
  mode,
}: ProductEditorProps) {
  const router = useRouter();
  const [product, setProduct] = useState<AdminProductInput>(
    initialProduct ?? blankProduct(),
  );
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [actionState, formAction, pending] = useActionState<
    ProductActionState,
    FormData
  >(
    mode === "create" ? createProductAction : updateProductAction,
    { ok: false, message: "" },
  );

  useEffect(() => {
    if (mode === "create" && actionState.ok && actionState.productId) {
      router.replace("/admin/products/" + actionState.productId + "?saved=1");
    }
  }, [actionState, mode, router]);

  function updateProduct<K extends keyof AdminProductInput>(
    key: K,
    value: AdminProductInput[K],
  ) {
    setProduct((current) => ({ ...current, [key]: value }));
  }

  function updateName(value: string) {
    setProduct((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugifyProductName(value),
    }));
  }

  function toggleCategory(categoryId: string) {
    setProduct((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((id) => id !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  }

  function addTextItem(
    key: "customerRequirements" | "seoKeywords" | "features" | "packageInclusions",
  ) {
    if (key === "features" || key === "packageInclusions") {
      const item = {
        id: "",
        text: "",
        active: true,
        sortOrder: product[key].length,
      };

      updateProduct(key, [...product[key], item]);
      return;
    }

    updateProduct(key, [...product[key], ""]);
  }

  function updateTextItem(
    key: "customerRequirements" | "seoKeywords" | "features" | "packageInclusions",
    index: number,
    value: string,
  ) {
    if (key === "features") {
      const list = [...product.features];
      list[index] = { ...list[index], text: value };
      updateProduct("features", list);
      return;
    }

    if (key === "packageInclusions") {
      const list = [...product.packageInclusions];
      list[index] = { ...list[index], text: value };
      updateProduct("packageInclusions", list);
      return;
    }

    if (key === "customerRequirements") {
      const list = [...product.customerRequirements];
      list[index] = value;
      updateProduct("customerRequirements", list);
      return;
    }

    const list = [...product.seoKeywords];
    list[index] = value;
    updateProduct("seoKeywords", list);
  }

  function toggleTextItem(
    key: "features" | "packageInclusions",
    index: number,
  ) {
    const list = [...product[key]] as AdminProductInput["features"];
    list[index] = { ...list[index], active: !list[index].active };
    updateProduct(key, list);
  }

  function removeTextItem(
    key: "customerRequirements" | "seoKeywords" | "features" | "packageInclusions",
    index: number,
  ) {
    updateProduct(
      key,
      product[key].filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function moveTextItem(
    key: "features" | "packageInclusions",
    index: number,
    direction: -1 | 1,
  ) {
    const list = [...product[key]] as AdminProductInput["features"];
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= list.length) {
      return;
    }

    [list[index], list[nextIndex]] = [list[nextIndex], list[index]];
    updateProduct(
      key,
      list.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })),
    );
  }

  function updatePlan(
    index: number,
    patch: Partial<AdminProductPlanInput>,
  ) {
    const plans = [...product.plans];
    plans[index] = { ...plans[index], ...patch };
    updateProduct(
      "plans",
      plans.map((plan, planIndex) => ({
        ...plan,
        sortOrder: planIndex,
      })),
    );
  }

  function addPlan() {
    updateProduct("plans", [
      ...product.plans,
      { ...NEW_PLAN, sortOrder: product.plans.length },
    ]);
  }

  function removePlan(index: number) {
    updateProduct(
      "plans",
      product.plans
        .filter((_, planIndex) => planIndex !== index)
        .map((plan, planIndex) => ({ ...plan, sortOrder: planIndex })),
    );
  }

  function movePlan(index: number, direction: -1 | 1) {
    const plans = [...product.plans];
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= plans.length) {
      return;
    }

    [plans[index], plans[nextIndex]] = [plans[nextIndex], plans[index]];
    updateProduct(
      "plans",
      plans.map((plan, planIndex) => ({ ...plan, sortOrder: planIndex })),
    );
  }

  function updatePlanArray(
    index: number,
    key: "features" | "customerRequirements",
    itemIndex: number,
    value: string,
  ) {
    const plans = [...product.plans];
    const list = [...plans[index][key]];
    list[itemIndex] = value;
    plans[index] = { ...plans[index], [key]: list };
    updateProduct("plans", plans);
  }

  function addPlanArrayItem(
    index: number,
    key: "features" | "customerRequirements",
  ) {
    const plans = [...product.plans];
    plans[index] = {
      ...plans[index],
      [key]: [...plans[index][key], ""],
    };
    updateProduct("plans", plans);
  }

  function removePlanArrayItem(
    index: number,
    key: "features" | "customerRequirements",
    itemIndex: number,
  ) {
    const plans = [...product.plans];
    plans[index] = {
      ...plans[index],
      [key]: plans[index][key].filter(
        (_, valueIndex) => valueIndex !== itemIndex,
      ),
    };
    updateProduct("plans", plans);
  }

  function updateAttribute(
    target: "product" | "plan",
    planIndex: number | null,
    oldKey: string,
    newKey: string,
    value: string,
  ) {
    const trimmedNewKey = newKey.slice(0, 80);

    if (target === "product") {
      const next = { ...product.customAttributes };
      if (oldKey !== trimmedNewKey) {
        delete next[oldKey];
      }
      next[trimmedNewKey || "attribute"] = value;
      updateProduct("customAttributes", next);
      return;
    }

    if (planIndex === null) {
      return;
    }

    const plans = [...product.plans];
    const next = { ...plans[planIndex].customAttributes };

    if (oldKey !== trimmedNewKey) {
      delete next[oldKey];
    }

    next[trimmedNewKey || "attribute"] = value;
    plans[planIndex] = { ...plans[planIndex], customAttributes: next };
    updateProduct("plans", plans);
  }

  function removeAttribute(
    target: "product" | "plan",
    planIndex: number | null,
    key: string,
  ) {
    if (target === "product") {
      const next = { ...product.customAttributes };
      delete next[key];
      updateProduct("customAttributes", next);
      return;
    }

    if (planIndex === null) {
      return;
    }

    const plans = [...product.plans];
    const next = { ...plans[planIndex].customAttributes };
    delete next[key];
    plans[planIndex] = { ...plans[planIndex], customAttributes: next };
    updateProduct("plans", plans);
  }

  function addAttribute(target: "product" | "plan", planIndex: number | null) {
    const base = "attribute";
    const keys =
      target === "product"
        ? Object.keys(product.customAttributes)
        : planIndex === null
          ? []
          : Object.keys(product.plans[planIndex].customAttributes);
    let key = base;
    let count = 2;

    while (keys.includes(key)) {
      key = base + "_" + count;
      count += 1;
    }

    updateAttribute(target, planIndex, "", key, "");
  }

  const actionError = actionState.ok ? "" : actionState.message;

  return (
    <form action={formAction} className="min-w-0">
      {mode === "edit" && product.id ? (
        <input type="hidden" name="productId" value={product.id} />
      ) : null}
      <input type="hidden" name="payload" value={JSON.stringify(product)} />

      <Container className="probee-section">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="probee-label">
              {mode === "create" ? "New product" : "Edit product"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              {mode === "create" ? "Create a product" : product.name || "Edit product"}
            </h1>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              The editor writes to the real catalog. Nothing here is a local-only
              mock.
            </p>
          </div>

          {mode === "edit" ? (
            <AdminStatus
              label={product.active ? "Active" : "Archived / inactive"}
              tone={product.active ? "success" : "neutral"}
            />
          ) : null}
        </div>

        {actionError ? (
          <Surface tone="muted" className="mt-6 border-red-400/30" role="alert">
            <p className="font-semibold text-red-100">Could not save product</p>
            <p className="mt-2 text-sm leading-6 text-red-200/80">{actionError}</p>
          </Surface>
        ) : null}

        {actionState.ok && mode === "edit" ? (
          <Surface className="mt-6 border-[var(--probee-border-default)]" role="status">
            <p className="text-sm font-semibold text-gold">{actionState.message}</p>
          </Surface>
        ) : null}

        <div className="mt-8 grid gap-5">
          <Surface className="p-5 sm:p-7">
            <details open>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Basic information
              </summary>

              <div className="mt-6 grid gap-5">
                <div>
                  <label htmlFor="product-name" className={labelClassName()}>
                    Product name <span className="text-gold">*</span>
                  </label>
                  <input
                    id="product-name"
                    required
                    value={product.name}
                    onChange={(event) => updateName(event.target.value)}
                    className={inputClassName()}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label htmlFor="product-slug" className={labelClassName()}>
                      Slug <span className="text-gold">*</span>
                    </label>
                    <input
                      id="product-slug"
                      required
                      value={product.slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        updateProduct("slug", event.target.value.toLowerCase());
                      }}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      className={inputClassName()}
                      aria-describedby="product-slug-hint"
                    />
                    <p id="product-slug-hint" className="mt-2 text-xs text-text-muted">
                      Lowercase letters, numbers and hyphens. Uniqueness is checked on the server.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="product-type" className={labelClassName()}>
                      Product type <span className="text-gold">*</span>
                    </label>
                    <select
                      id="product-type"
                      value={product.productType}
                      onChange={(event) =>
                        updateProduct(
                          "productType",
                          event.target.value as AdminProductInput["productType"],
                        )
                      }
                      className={inputClassName()}
                    >
                      {productTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="short-description" className={labelClassName()}>
                    Short description
                  </label>
                  <textarea
                    id="short-description"
                    value={product.shortDescription}
                    onChange={(event) =>
                      updateProduct("shortDescription", event.target.value)
                    }
                    rows={3}
                    className={inputClassName("py-3")}
                  />
                </div>

                <div>
                  <label htmlFor="full-description" className={labelClassName()}>
                    Full description
                  </label>
                  <textarea
                    id="full-description"
                    value={product.fullDescription}
                    onChange={(event) =>
                      updateProduct("fullDescription", event.target.value)
                    }
                    rows={6}
                    className={inputClassName("py-3")}
                  />
                </div>
              </div>
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details open>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Catalog state
              </summary>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["active", "Active", "Product can participate in normal catalog workflows."],
                  ["published", "Published", "Product can be visible to public storefront readers."],
                  ["featured", "Featured", "Product can be highlighted by future storefront sections."],
                ].map(([key, label, hint]) => (
                  <label
                    key={key}
                    className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(product[key as "active" | "published" | "featured"])}
                      onChange={(event) =>
                        updateProduct(
                          key as "active" | "published" | "featured",
                          event.target.checked,
                        )
                      }
                      className="mt-1 size-4 accent-[var(--probee-gold)]"
                    />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="mt-1 block text-xs leading-5 text-text-muted">
                        {hint}
                      </span>
                    </span>
                  </label>
                ))}

                <div>
                  <label htmlFor="sort-order" className={labelClassName()}>
                    Display order
                  </label>
                  <input
                    id="sort-order"
                    type="number"
                    min={0}
                    value={product.sortOrder}
                    onChange={(event) =>
                      updateProduct(
                        "sortOrder",
                        Number.parseInt(event.target.value || "0", 10),
                      )
                    }
                    className={inputClassName()}
                  />
                </div>
              </div>
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details open>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Categories
              </summary>

              <div className="mt-6">
                {categories.length === 0 ? (
                  <div className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-5">
                    <p className="text-sm font-semibold">No categories exist yet</p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">
                      Category management is not part of STEP 7. Create categories
                      in a future category-management stage before assigning them.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                      <label
                        key={category.id}
                        className="flex cursor-pointer items-start gap-3 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 p-4"
                      >
                        <input
                          type="checkbox"
                          checked={product.categoryIds.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          className="mt-1 size-4 accent-[var(--probee-gold)]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {category.name}
                          </span>
                          <span className="mt-1 block truncate text-xs text-text-muted">
                            {category.slug}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details open>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Features & package inclusions
              </summary>

              <div className="mt-6 grid gap-8 lg:grid-cols-2">
                {[
                  {
                    key: "features" as const,
                    title: "Features",
                    empty: "No product features added.",
                  },
                  {
                    key: "packageInclusions" as const,
                    title: "Package inclusions",
                    empty: "No package inclusions added.",
                  },
                ].map((section) => (
                  <div key={section.key}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">{section.title}</h2>
                        <p className="mt-1 text-xs text-text-muted">
                          Reorder and activate items without hard-coded copy.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => addTextItem(section.key)}
                      >
                        Add
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {product[section.key].length === 0 ? (
                        <p className="rounded-lg border border-dashed border-[var(--probee-border-default)] p-4 text-sm text-text-muted">
                          {section.empty}
                        </p>
                      ) : null}

                      {product[section.key].map((item, index) => (
                        <div
                          key={item.id || makeId(section.key, index)}
                          className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-3"
                        >
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <input
                              aria-label={section.title + " item " + (index + 1)}
                              value={item.text}
                              onChange={(event) =>
                                updateTextItem(
                                  section.key,
                                  index,
                                  event.target.value,
                                )
                              }
                              className={inputClassName()}
                              placeholder={
                                section.key === "features"
                                  ? "Example: Flexible duration"
                                  : "Example: Setup guidance"
                              }
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleTextItem(section.key, index)}
                                className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold"
                              >
                                {item.active ? "Active" : "Inactive"}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTextItem(section.key, index, -1)}
                                disabled={index === 0}
                                aria-label="Move item up"
                                className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs disabled:opacity-40"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTextItem(section.key, index, 1)}
                                disabled={index === product[section.key].length - 1}
                                aria-label="Move item down"
                                className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs disabled:opacity-40"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTextItem(section.key, index)}
                                className="probee-focus-ring min-h-10 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200 hover:bg-red-400/10"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Warranty, delivery & customer requirements
              </summary>

              <div className="mt-6 grid gap-6">
                <div>
                  <p className="text-sm font-semibold">Product warranty</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      aria-label="Warranty duration"
                      type="number"
                      min={1}
                      value={product.warrantyDuration ?? ""}
                      onChange={(event) =>
                        updateProduct(
                          "warrantyDuration",
                          parseOptionalNumber(event.target.value),
                        )
                      }
                      className={inputClassName()}
                      placeholder="Duration"
                    />
                    <select
                      aria-label="Warranty unit"
                      value={product.warrantyUnit}
                      onChange={(event) =>
                        updateProduct(
                          "warrantyUnit",
                          event.target.value as AdminProductInput["warrantyUnit"],
                        )
                      }
                      className={inputClassName()}
                    >
                      {durationUnitOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="delivery-type" className={labelClassName()}>
                      Delivery type
                    </label>
                    <input
                      id="delivery-type"
                      value={product.deliveryType}
                      onChange={(event) =>
                        updateProduct("deliveryType", event.target.value)
                      }
                      className={inputClassName()}
                      placeholder="Digital delivery, manual activation…"
                    />
                  </div>
                  <div>
                    <label htmlFor="delivery-details" className={labelClassName()}>
                      Delivery details
                    </label>
                    <textarea
                      id="delivery-details"
                      value={product.deliveryDetails}
                      onChange={(event) =>
                        updateProduct("deliveryDetails", event.target.value)
                      }
                      rows={3}
                      className={inputClassName("py-3")}
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 p-4">
                  <input
                    type="checkbox"
                    checked={product.requiresCustomerEmail}
                    onChange={(event) =>
                      updateProduct("requiresCustomerEmail", event.target.checked)
                    }
                    className="mt-1 size-4 accent-[var(--probee-gold)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      Require customer email for this product
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-text-muted">
                      This flag is stored with the catalog record for future checkout flows.
                    </span>
                  </span>
                </label>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Customer requirements</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Use repeatable fields rather than raw JSON.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => addTextItem("customerRequirements")}
                    >
                      Add
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {product.customerRequirements.map((item, index) => (
                      <div key={makeId("requirement", index)} className="flex gap-2">
                        <input
                          aria-label={"Customer requirement " + (index + 1)}
                          value={item}
                          onChange={(event) =>
                            updateTextItem(
                              "customerRequirements",
                              index,
                              event.target.value,
                            )
                          }
                          className={inputClassName()}
                          placeholder="Example: Customer email address"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            removeTextItem("customerRequirements", index)
                          }
                          className="probee-focus-ring min-h-11 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Custom attributes
              </summary>
              <div className="mt-6">
                <p className="text-sm leading-6 text-text-muted">
                  Flexible key/value metadata is serialized safely into the STEP 6 JSONB object.
                </p>

                <div className="mt-4 grid gap-3">
                  {Object.entries(product.customAttributes).map(
                    ([key, value]) => (
                      <div key={key} className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]">
                        <input
                          value={key}
                          onChange={(event) =>
                            updateAttribute(
                              "product",
                              null,
                              key,
                              event.target.value,
                              value,
                            )
                          }
                          aria-label="Custom attribute key"
                          className={inputClassName()}
                          placeholder="Key"
                        />
                        <input
                          value={value}
                          onChange={(event) =>
                            updateAttribute(
                              "product",
                              null,
                              key,
                              key,
                              event.target.value,
                            )
                          }
                          aria-label="Custom attribute value"
                          className={inputClassName()}
                          placeholder="Value"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttribute("product", null, key)}
                          className="probee-focus-ring min-h-11 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200"
                        >
                          Remove
                        </button>
                      </div>
                    ),
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => addAttribute("product", null)}
                >
                  Add attribute
                </Button>
              </div>
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                SEO
              </summary>

              <div className="mt-6 grid gap-5">
                <div>
                  <label htmlFor="seo-title" className={labelClassName()}>
                    SEO title
                  </label>
                  <input
                    id="seo-title"
                    value={product.seoTitle}
                    onChange={(event) =>
                      updateProduct("seoTitle", event.target.value)
                    }
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label htmlFor="seo-description" className={labelClassName()}>
                    SEO description
                  </label>
                  <textarea
                    id="seo-description"
                    rows={4}
                    value={product.seoDescription}
                    onChange={(event) =>
                      updateProduct("seoDescription", event.target.value)
                    }
                    className={inputClassName("py-3")}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">SEO keywords</p>
                      <p className="mt-1 text-xs text-text-muted">
                        One keyword per field.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => addTextItem("seoKeywords")}
                    >
                      Add
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {product.seoKeywords.map((keyword, index) => (
                      <div key={makeId("keyword", index)} className="flex gap-2">
                        <input
                          aria-label={"SEO keyword " + (index + 1)}
                          value={keyword}
                          onChange={(event) =>
                            updateTextItem(
                              "seoKeywords",
                              index,
                              event.target.value,
                            )
                          }
                          className={inputClassName()}
                          placeholder="Keyword"
                        />
                        <button
                          type="button"
                          onClick={() => removeTextItem("seoKeywords", index)}
                          className="probee-focus-ring min-h-11 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details open>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Product media
              </summary>

              <ProductMediaManager
                productId={product.id}
                productName={product.name || "Product"}
                initialMedia={product.media}
              />
            </details>
          </Surface>

          <Surface className="p-5 sm:p-7">
            <details open>
              <summary className="cursor-pointer list-none text-xl font-semibold focus-visible:outline-2 focus-visible:outline-gold">
                Product plans
              </summary>

              <div className="mt-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-sm font-semibold">
                      {product.plans.length} plan{product.plans.length === 1 ? "" : "s"} configured
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Each plan can use a different pricing, duration, limits and delivery model.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={addPlan}>
                    Add plan
                  </Button>
                </div>

                <div className="mt-5 grid gap-4">
                  {product.plans.length === 0 ? (
                    <div className="rounded-[var(--probee-radius-md)] border border-dashed border-[var(--probee-border-default)] bg-surface-2 p-5">
                      <p className="text-sm font-semibold">No plans yet</p>
                      <p className="mt-2 text-sm leading-6 text-text-muted">
                        Some products can exist with no plan records; add plans only when the product needs them.
                      </p>
                    </div>
                  ) : null}

                  {product.plans.map((plan, index) => (
                    <div
                      key={plan.id || makeId("plan", index)}
                      className="rounded-[var(--probee-radius-lg)] border border-[var(--probee-border-default)] bg-surface-2 p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            Plan {index + 1}
                            {plan.name ? ": " + plan.name : ""}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            Order {index}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => movePlan(index, -1)}
                            disabled={index === 0}
                            className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => movePlan(index, 1)}
                            disabled={index === product.plans.length - 1}
                            className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePlan(index, { active: !plan.active })}
                            className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold"
                          >
                            {plan.active ? "Active" : "Inactive"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removePlan(index)}
                            className="probee-focus-ring min-h-10 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-5">
                        <div className="grid gap-5 md:grid-cols-2">
                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-name", index)}>
                              Plan name *
                            </label>
                            <input
                              id={makeId("plan-name", index)}
                              required
                              value={plan.name}
                              onChange={(event) =>
                                updatePlan(index, { name: event.target.value })
                              }
                              className={inputClassName()}
                            />
                          </div>

                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-slug", index)}>
                              Plan slug *
                            </label>
                            <input
                              id={makeId("plan-slug", index)}
                              required
                              value={plan.slug}
                              onChange={(event) =>
                                updatePlan(index, {
                                  slug: event.target.value.toLowerCase(),
                                })
                              }
                              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                              className={inputClassName()}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClassName()} htmlFor={makeId("plan-description", index)}>
                            Plan description
                          </label>
                          <textarea
                            id={makeId("plan-description", index)}
                            rows={3}
                            value={plan.description}
                            onChange={(event) =>
                              updatePlan(index, { description: event.target.value })
                            }
                            className={inputClassName("py-3")}
                          />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-price", index)}>
                              Price *
                            </label>
                            <input
                              id={makeId("plan-price", index)}
                              type="number"
                              min={0}
                              step="0.01"
                              value={plan.price}
                              onChange={(event) =>
                                updatePlan(index, {
                                  price: Number(event.target.value || 0),
                                })
                              }
                              className={inputClassName()}
                            />
                          </div>

                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-currency", index)}>
                              Currency *
                            </label>
                            <input
                              id={makeId("plan-currency", index)}
                              maxLength={3}
                              value={plan.currency}
                              onChange={(event) =>
                                updatePlan(index, {
                                  currency: event.target.value.toUpperCase(),
                                })
                              }
                              className={inputClassName()}
                            />
                          </div>

                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-billing", index)}>
                              Billing model
                            </label>
                            <select
                              id={makeId("plan-billing", index)}
                              value={plan.billingType}
                              onChange={(event) =>
                                updatePlan(index, {
                                  billingType:
                                    event.target.value as AdminProductPlanInput["billingType"],
                                  billingInterval:
                                    event.target.value === "subscription"
                                      ? plan.billingInterval
                                      : "",
                                  billingIntervalCount:
                                    event.target.value === "subscription"
                                      ? plan.billingIntervalCount
                                      : null,
                                })
                              }
                              className={inputClassName()}
                            >
                              <option value="one_time">One-time</option>
                              <option value="subscription">Subscription</option>
                            </select>
                          </div>

                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-duration", index)}>
                              Duration
                            </label>
                            <input
                              id={makeId("plan-duration", index)}
                              type="number"
                              min={1}
                              value={plan.duration ?? ""}
                              onChange={(event) =>
                                updatePlan(index, {
                                  duration: parseOptionalNumber(event.target.value),
                                })
                              }
                              className={inputClassName()}
                              placeholder="Optional"
                            />
                          </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-duration-unit", index)}>
                              Duration unit
                            </label>
                            <select
                              id={makeId("plan-duration-unit", index)}
                              value={plan.durationUnit}
                              onChange={(event) =>
                                updatePlan(index, {
                                  durationUnit:
                                    event.target.value as AdminProductPlanInput["durationUnit"],
                                })
                              }
                              className={inputClassName()}
                            >
                              {durationUnitOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-billing-interval", index)}>
                              Billing interval
                            </label>
                            <select
                              id={makeId("plan-billing-interval", index)}
                              disabled={plan.billingType !== "subscription"}
                              value={plan.billingInterval}
                              onChange={(event) =>
                                updatePlan(index, {
                                  billingInterval:
                                    event.target.value as AdminProductPlanInput["billingInterval"],
                                })
                              }
                              className={inputClassName()}
                            >
                              {billingIntervalOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-billing-count", index)}>
                              Interval count
                            </label>
                            <input
                              id={makeId("plan-billing-count", index)}
                              disabled={plan.billingType !== "subscription"}
                              type="number"
                              min={1}
                              value={plan.billingIntervalCount ?? ""}
                              onChange={(event) =>
                                updatePlan(index, {
                                  billingIntervalCount: parseOptionalNumber(
                                    event.target.value,
                                  ),
                                })
                              }
                              className={inputClassName()}
                            />
                          </div>

                          <label className="flex cursor-pointer items-center gap-3 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3">
                            <input
                              type="checkbox"
                              checked={plan.renewalAvailable}
                              onChange={(event) =>
                                updatePlan(index, {
                                  renewalAvailable: event.target.checked,
                                })
                              }
                              className="size-4 accent-[var(--probee-gold)]"
                            />
                            <span className="text-sm font-medium">Renewal available</span>
                          </label>
                        </div>

                        <div>
                          <p className="text-sm font-semibold">Plan warranty</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input
                              aria-label="Plan warranty duration"
                              type="number"
                              min={1}
                              value={plan.warrantyDuration ?? ""}
                              onChange={(event) =>
                                updatePlan(index, {
                                  warrantyDuration: parseOptionalNumber(event.target.value),
                                })
                              }
                              className={inputClassName()}
                              placeholder="Duration"
                            />
                            <select
                              aria-label="Plan warranty unit"
                              value={plan.warrantyUnit}
                              onChange={(event) =>
                                updatePlan(index, {
                                  warrantyUnit:
                                    event.target.value as AdminProductPlanInput["warrantyUnit"],
                                })
                              }
                              className={inputClassName()}
                            >
                              {durationUnitOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-3">
                          {[
                            ["seats", "Seats"],
                            ["invites", "Invites"],
                            ["participants", "Participants"],
                          ].map(([key, label]) => (
                            <div key={key}>
                              <label className={labelClassName()} htmlFor={makeId("plan-" + key, index)}>
                                {label}
                              </label>
                              <input
                                id={makeId("plan-" + key, index)}
                                type="number"
                                min={1}
                                value={plan[key as "seats" | "invites" | "participants"] ?? ""}
                                onChange={(event) =>
                                  updatePlan(index, {
                                    [key]: parseOptionalNumber(event.target.value),
                                  })
                                }
                                className={inputClassName()}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-delivery-type", index)}>
                              Delivery type
                            </label>
                            <input
                              id={makeId("plan-delivery-type", index)}
                              value={plan.deliveryType}
                              onChange={(event) =>
                                updatePlan(index, { deliveryType: event.target.value })
                              }
                              className={inputClassName()}
                            />
                          </div>
                          <div>
                            <label className={labelClassName()} htmlFor={makeId("plan-delivery-details", index)}>
                              Delivery details
                            </label>
                            <textarea
                              id={makeId("plan-delivery-details", index)}
                              rows={3}
                              value={plan.deliveryDetails}
                              onChange={(event) =>
                                updatePlan(index, {
                                  deliveryDetails: event.target.value,
                                })
                              }
                              className={inputClassName("py-3")}
                            />
                          </div>
                        </div>

                        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 p-4">
                          <input
                            type="checkbox"
                            checked={plan.requiresCustomerEmail}
                            onChange={(event) =>
                              updatePlan(index, {
                                requiresCustomerEmail: event.target.checked,
                              })
                            }
                            className="mt-1 size-4 accent-[var(--probee-gold)]"
                          />
                          <span>
                            <span className="block text-sm font-medium">
                              Require customer email
                            </span>
                            <span className="mt-1 block text-xs text-text-muted">
                              Stored for future checkout requirements.
                            </span>
                          </span>
                        </label>

                        {(["features", "customerRequirements"] as const).map((key) => (
                          <div key={key}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">
                                  {key === "features"
                                    ? "Plan features"
                                    : "Plan customer requirements"}
                                </p>
                                <p className="mt-1 text-xs text-text-muted">
                                  Repeatable values stored as JSONB arrays.
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => addPlanArrayItem(index, key)}
                              >
                                Add
                              </Button>
                            </div>

                            <div className="mt-3 grid gap-2">
                              {plan[key].map((item, itemIndex) => (
                                <div key={makeId(key, itemIndex)} className="flex gap-2">
                                  <input
                                    aria-label={
                                      (key === "features"
                                        ? "Plan feature "
                                        : "Plan customer requirement ") +
                                      (itemIndex + 1)
                                    }
                                    value={item}
                                    onChange={(event) =>
                                      updatePlanArray(
                                        index,
                                        key,
                                        itemIndex,
                                        event.target.value,
                                      )
                                    }
                                    className={inputClassName()}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removePlanArrayItem(index, key, itemIndex)
                                    }
                                    className="probee-focus-ring min-h-11 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        <div>
                          <p className="text-sm font-semibold">Plan custom attributes</p>
                          <div className="mt-3 grid gap-3">
                            {Object.entries(plan.customAttributes).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]"
                                >
                                  <input
                                    value={key}
                                    aria-label="Plan custom attribute key"
                                    onChange={(event) =>
                                      updateAttribute(
                                        "plan",
                                        index,
                                        key,
                                        event.target.value,
                                        value,
                                      )
                                    }
                                    className={inputClassName()}
                                  />
                                  <input
                                    value={value}
                                    aria-label="Plan custom attribute value"
                                    onChange={(event) =>
                                      updateAttribute(
                                        "plan",
                                        index,
                                        key,
                                        key,
                                        event.target.value,
                                      )
                                    }
                                    className={inputClassName()}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeAttribute("plan", index, key)
                                    }
                                    className="probee-focus-ring min-h-11 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ),
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-3"
                            onClick={() => addAttribute("plan", index)}
                          >
                            Add plan attribute
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </Surface>
        </div>
      </Container>

      <SaveBar />
      <div className="sr-only" aria-live="polite">
        {pending ? "Saving product" : actionState.message}
      </div>
    </form>
  );
}
