import type { Metadata } from "next";
import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { EmptyState } from "@/components/store/empty-state";
import { ProductMediaGallery } from "@/components/store/product-media-gallery";
import { ProductPlanSelector } from "@/components/store/product-plan-selector";
import { ProductReviews } from "@/components/store/product-reviews";
import { formatDuration, formatProductPrice } from "@/lib/catalog/format";
import { getPublicCatalogProductBySlug } from "@/lib/catalog/server";
import type { ReviewSort } from "@/lib/reviews/types";

interface ProductDetailsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: ProductDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicCatalogProductBySlug(slug);

  return {
    title: product?.seo?.title ?? product?.name ?? `${slug} | ProBee`,
    description:
      product?.seo?.description ??
      product?.shortDescription ??
      "Product details on ProBee.",
    keywords: product?.seo?.keywords,
  };
}

function formatDynamicValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : serialized;
  } catch {
    return null;
  }
}

export default async function ProductDetailsPage({
  params,
  searchParams,
}: ProductDetailsPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const product = await getPublicCatalogProductBySlug(slug);

  if (!product) {
    return (
      <section className="probee-section">
        <Container>
          <nav className="mb-6 text-sm text-text-muted" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  className="probee-focus-ring rounded hover:text-text-primary"
                  href="/"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  className="probee-focus-ring rounded hover:text-text-primary"
                  href="/products"
                >
                  Products
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-text-secondary" aria-current="page">
                {slug}
              </li>
            </ol>
          </nav>

          <EmptyState
            title="Product not found"
            description="This product is not currently published in the public ProBee catalog."
          />
        </Container>
      </section>
    );
  }

  const price = formatProductPrice(product);
  const purchasablePlans = product.plans.filter(
    (plan) => plan.active !== false,
  );
  const productAttributes = Object.entries(product.customAttributes ?? {}).filter(
    ([, value]) => formatDynamicValue(value) !== null,
  );

  const rawReviewSort = getSingleParam(query, "reviewSort");
  const reviewSort: ReviewSort =
    rawReviewSort === "highest" || rawReviewSort === "lowest"
      ? rawReviewSort
      : "newest";
  const reviewPageValue = Number.parseInt(
    getSingleParam(query, "reviewPage"),
    10,
  );
  const reviewPage =
    Number.isFinite(reviewPageValue) && reviewPageValue > 0
      ? Math.min(reviewPageValue, 1000)
      : 1;

  return (
    <section className="probee-section">
      <Container>
        <nav className="mb-8 text-sm text-text-muted" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                className="probee-focus-ring rounded hover:text-text-primary"
                href="/"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                className="probee-focus-ring rounded hover:text-text-primary"
                href="/products"
              >
                Products
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-text-secondary" aria-current="page">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <ProductMediaGallery
            productName={product.name}
            coverUrl={product.coverUrl}
            media={product.media}
          />

          <div>
            {product.category ? (
              <p className="probee-label">{product.category.name}</p>
            ) : null}
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              {product.name}
            </h1>
            {product.shortDescription ? (
              <p className="mt-4 text-base leading-7 text-text-secondary">
                {product.shortDescription}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {price ? (
                <span className="text-lg font-semibold text-gold">{price}</span>
              ) : null}
              {product.featured ? (
                <span className="rounded-full border border-[var(--probee-border-default)] bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-gold">
                  Featured
                </span>
              ) : null}
              {product.requiresCustomerEmail ? (
                <span className="rounded-full border border-[var(--probee-border-default)] bg-surface-2 px-3 py-1 text-xs font-semibold text-text-secondary">
                  Customer email required
                </span>
              ) : null}
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold">Choose your plan</h2>
              <p className="mt-2 text-sm text-text-muted">
                Options shown here are loaded from the active catalog configuration.
              </p>
              <div className="mt-4">
                <ProductPlanSelector
                  productId={product.id}
                  plans={purchasablePlans}
                />
              </div>
            </div>
          </div>
        </div>

        {product.fullDescription ? (
          <section className="mt-14 border-t border-[var(--probee-border-subtle)] pt-10">
            <h2 className="text-2xl font-semibold">About this product</h2>
            <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-7 text-text-secondary">
              {product.fullDescription}
            </p>
          </section>
        ) : null}

        {product.features?.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Features</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {product.features.map((feature, index) => (
                <Surface
                  key={feature + index}
                  className="p-4 text-sm text-text-secondary"
                >
                  {feature}
                </Surface>
              ))}
            </div>
          </section>
        ) : null}

        {product.packageInclusions?.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Package inclusions</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {product.packageInclusions.map((item, index) => (
                <Surface
                  key={item + index}
                  className="p-4 text-sm text-text-secondary"
                >
                  {item}
                </Surface>
              ))}
            </div>
          </section>
        ) : null}

        {product.delivery ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Delivery</h2>
            <Surface className="mt-5 p-5">
              {product.delivery.label ? (
                <p className="font-medium">{product.delivery.label}</p>
              ) : null}
              {product.delivery.type ? (
                <p className="mt-1 text-sm text-text-muted">
                  Method: {product.delivery.type}
                </p>
              ) : null}
              {product.delivery.description ? (
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  {product.delivery.description}
                </p>
              ) : null}
            </Surface>
          </section>
        ) : null}

        {product.customerRequirements?.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Customer requirements</h2>
            <div className="mt-5 grid gap-3">
              {product.customerRequirements.map((requirement, index) => {
                const value = formatDynamicValue(requirement);

                return value ? (
                  <p
                    key={value + index}
                    className="text-sm leading-6 text-text-secondary"
                  >
                    {value}
                  </p>
                ) : null;
              })}
            </div>
          </section>
        ) : null}

        {productAttributes.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Product details</h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {productAttributes.map(([key, value]) => {
                const formattedValue = formatDynamicValue(value);

                return formattedValue ? (
                  <Surface key={key} className="p-4">
                    <dt className="text-xs uppercase tracking-[0.12em] text-text-muted">
                      {key}
                    </dt>
                    <dd className="mt-1 text-sm leading-6 text-text-secondary">
                      {formattedValue}
                    </dd>
                  </Surface>
                ) : null;
              })}
            </dl>
          </section>
        ) : null}

        {product.plans.some(
          (plan) => plan.warrantyPeriod && plan.warrantyUnit,
        ) ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Warranty</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {product.plans
                .filter((plan) => plan.warrantyPeriod && plan.warrantyUnit)
                .map((plan) => (
                  <Surface key={plan.id} className="p-5">
                    <p className="font-medium">{plan.name}</p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {formatDuration(plan.warrantyPeriod, plan.warrantyUnit)}
                    </p>
                  </Surface>
                ))}
            </div>
          </section>
        ) : null}

        <ProductReviews
          productId={product.id}
          page={reviewPage}
          sort={reviewSort}
        />
      </Container>
    </section>
  );
}
