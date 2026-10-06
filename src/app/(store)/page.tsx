import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { CategoryGrid } from "@/components/store/category-grid";
import { ProductGrid } from "@/components/store/product-grid";
import {
  getPublicCatalogCategories,
  getPublicCatalogFeaturedProducts,
} from "@/lib/catalog/server";

const values = [
  {
    title: "Security-first foundation",
    description:
      "The storefront is built on a server-aware architecture with database access designed around row-level security.",
  },
  {
    title: "Flexible product structure",
    description:
      "Products can expose different plans, durations, limits, warranties and delivery requirements without changing the storefront components.",
  },
  {
    title: "Delivery-ready experience",
    description:
      "The catalog can describe delivery requirements and future digital entitlement flows without exposing private assets publicly.",
  },
];

export default async function HomePage() {
  const [featuredProducts, categories] = await Promise.all([
    getPublicCatalogFeaturedProducts(6),
    getPublicCatalogCategories(),
  ]);

  return (
    <>
      <section className="border-b border-[var(--probee-border-subtle)]">
        <Container className="probee-section">
          <div className="max-w-4xl">
            <p className="probee-label">Premium digital commerce</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Digital products, presented with clarity.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
              A premium storefront designed to make different product plans,
              durations and delivery options easy to understand.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/products"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-5 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover probee-focus-ring sm:w-auto"
              >
                Explore products
              </Link>
              <Link
                href="/#categories"
                className="probee-focus-ring inline-flex min-h-12 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-5 text-sm font-semibold text-text-primary transition-colors hover:border-[var(--probee-border-strong)] hover:bg-surface-2"
              >
                Browse categories
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="probee-section">
        <Container>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="probee-label">Featured products</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
                Curated when the catalog is live.
              </h2>
            </div>
            <Link
              href="/products"
              className="probee-focus-ring w-fit rounded text-sm font-semibold text-gold hover:text-gold-hover"
            >
              View all products
            </Link>
          </div>

          <div className="mt-8">
            <ProductGrid products={featuredProducts} />
          </div>
        </Container>
      </section>

      <section id="categories" className="border-y border-[var(--probee-border-subtle)] bg-surface-1">
        <Container className="probee-section">
          <div>
            <p className="probee-label">Categories</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
              A catalog structure that can evolve with the store.
            </h2>
          </div>
          <div className="mt-8">
            <CategoryGrid categories={categories} />
          </div>
        </Container>
      </section>

      <section id="why-probee" className="probee-section">
        <Container>
          <div className="max-w-2xl">
            <p className="probee-label">Why ProBee</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
              Built around flexible products, not fixed templates.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {values.map((value) => (
              <Surface key={value.title} className="p-6">
                <h3 className="text-lg font-semibold">{value.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  {value.description}
                </p>
              </Surface>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-[var(--probee-border-subtle)] bg-surface-1">
        <Container className="probee-section">
          <div className="max-w-3xl">
            <p className="probee-label">Ready when the catalog is ready</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              One storefront can support many product models.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
              Plans, durations, seats, participants, warranties, delivery
              requirements and custom attributes can all come from the catalog
              rather than being hard-coded into the UI.
            </p>
            <div className="mt-7">
              <Link
                href="/products"
                className="inline-flex min-h-12 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-5 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover probee-focus-ring"
              >
                Explore the catalog
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
