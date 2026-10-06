import type { Metadata } from "next";
import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { EmptyState } from "@/components/store/empty-state";
import { ProductMediaGallery } from "@/components/store/product-media-gallery";
import { ProductPlanSelector } from "@/components/store/product-plan-selector";
import { formatDuration, formatProductPrice } from "@/lib/catalog/format";
import type { CatalogProduct } from "@/lib/catalog/types";

interface ProductDetailsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `${slug} | ProBee`,
    description: "Product details on ProBee.",
  };
}

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { slug } = await params;

  // The future catalog query layer will resolve this by slug.
  const product: CatalogProduct | null = null;

  if (!product) {
    return (
      <section className="probee-section">
        <Container>
          <nav className="mb-6 text-sm text-text-muted" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link className="probee-focus-ring rounded hover:text-text-primary" href="/">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link className="probee-focus-ring rounded hover:text-text-primary" href="/products">
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
            title="Product details are ready for catalog data"
            description="This route is prepared for dynamic product media, plans, pricing, delivery details and requirements. No product records are loaded in this step."
          />
        </Container>
      </section>
    );
  }

  const price = formatProductPrice(product);

  return (
    <section className="probee-section">
      <Container>
        <nav className="mb-8 text-sm text-text-muted" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link className="probee-focus-ring rounded hover:text-text-primary" href="/">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link className="probee-focus-ring rounded hover:text-text-primary" href="/products">
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
              {price ? <span className="text-lg font-semibold text-gold">{price}</span> : null}
              {product.featured ? (
                <span className="rounded-full border border-[var(--probee-border-default)] bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-gold">
                  Featured
                </span>
              ) : null}
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold">Plans & options</h2>
              <p className="mt-2 text-sm text-text-muted">
                Choose from the options configured for this product.
              </p>
              <div className="mt-4">
                <ProductPlanSelector plans={product.plans} />
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
              {product.features.map((feature) => (
                <Surface key={feature} className="p-4 text-sm text-text-secondary">
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
              {product.packageInclusions.map((item) => (
                <Surface key={item} className="p-4 text-sm text-text-secondary">
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
              {product.customerRequirements.map((requirement) => (
                <p
                  key={requirement}
                  className="text-sm leading-6 text-text-secondary"
                >
                  {requirement}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {product.plans.some((plan) => plan.warrantyPeriod && plan.warrantyUnit) ? (
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

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Reviews</h2>
          <Surface className="mt-5 p-5">
            <p className="text-sm text-text-muted">
              Reviews will appear here when the moderation and verified-purchase layer is enabled.
            </p>
          </Surface>
        </section>
      </Container>
    </section>
  );
}
