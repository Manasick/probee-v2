import Link from "next/link";
import { Container, Surface, BrandMark } from "@/components/ui";
import { CategoryGrid } from "@/components/store/category-grid";
import { ProductGrid } from "@/components/store/product-grid";
import {
  getPublicCatalogCategories,
  getPublicCatalogFeaturedProducts,
} from "@/lib/catalog/server";

const values = [
  {
    eyebrow: "01",
    title: "Built to scale",
    description:
      "Flexible products, plans, durations, warranties and delivery requirements live in the catalog—not inside hard-coded product pages.",
  },
  {
    eyebrow: "02",
    title: "Security by design",
    description:
      "Customer, payment and digital-delivery workflows are backed by server-side authorization and row-level security.",
  },
  {
    eyebrow: "03",
    title: "Ready for automation",
    description:
      "The storefront is designed to become the premium customer layer of a larger automated ProBee commerce system.",
  },
];

export default async function HomePage() {
  const [featuredProducts, categories] = await Promise.all([
    getPublicCatalogFeaturedProducts(6),
    getPublicCatalogCategories(),
  ]);

  return (
    <>
      <section className="probee-hero relative isolate overflow-hidden">
        <div className="probee-hero-orbit probee-hero-orbit-one" aria-hidden="true" />
        <div className="probee-hero-orbit probee-hero-orbit-two" aria-hidden="true" />
        <div className="probee-hero-stars" aria-hidden="true" />

        <Container className="relative z-10">
          <div className="grid min-h-[calc(100vh-4rem)] items-center gap-12 py-20 lg:grid-cols-[1.08fr_.92fr] lg:py-24">
            <div className="max-w-3xl motion-fade-in">
              <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[var(--probee-gold-border)] bg-black/30 px-4 py-2 backdrop-blur-xl">
                <span className="probee-live-dot" aria-hidden="true" />
                <span className="probee-label text-[0.68rem] text-[var(--probee-gold)]">
                  Premium digital commerce
                </span>
              </div>

              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.045em] sm:text-7xl lg:text-[6.5rem]">
                <span className="block">Built for the</span>
                <span className="probee-gold-text block">next level.</span>
              </h1>

              <p className="mt-7 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
                Discover premium digital products through a storefront designed
                for clarity, trust and a future where commerce runs smarter.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/products"
                  className="probee-primary-button probee-focus-ring inline-flex min-h-13 items-center justify-center rounded-full px-7 text-sm font-semibold"
                >
                  Explore the collection
                  <span aria-hidden="true" className="ml-3 text-base">↗</span>
                </Link>
                <Link
                  href="/#categories"
                  className="probee-secondary-button probee-focus-ring inline-flex min-h-13 items-center justify-center rounded-full px-7 text-sm font-semibold"
                >
                  Discover categories
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs text-text-muted">
                <span>Secure checkout</span>
                <span>Flexible packages</span>
                <span>Digital delivery ready</span>
              </div>
            </div>

            <div className="relative mx-auto flex w-full max-w-[32rem] items-center justify-center lg:min-h-[34rem]">
              <div className="probee-hero-halo" aria-hidden="true" />
              <div className="probee-hero-ring probee-hero-ring-outer" aria-hidden="true" />
              <div className="probee-hero-ring probee-hero-ring-inner" aria-hidden="true" />

              <div className="probee-brand-stage">
                <div className="probee-bee-mark" aria-hidden="true">
                  <span className="bee-wing bee-wing-left" />
                  <span className="bee-wing bee-wing-right" />
                  <span className="bee-body" />
                  <span className="bee-eye" />
                </div>
                <BrandMark className="probee-stage-brand" />
                <span className="probee-stage-line">Premium digital commerce</span>
              </div>

              <div className="probee-floating-card probee-floating-card-top">
                <span className="probee-card-kicker">PROBEE</span>
                <strong>Premium by design.</strong>
              </div>
              <div className="probee-floating-card probee-floating-card-bottom">
                <span className="probee-card-kicker">SYSTEM</span>
                <strong>Ready to scale.</strong>
              </div>
            </div>
          </div>
        </Container>

        <div className="probee-scroll-cue" aria-hidden="true">
          <span>Scroll to explore</span>
          <i />
        </div>
      </section>

      <section className="border-y border-[var(--probee-border-subtle)] bg-surface-1/70">
        <Container className="probee-section !py-14">
          <div className="grid gap-8 md:grid-cols-3">
            {values.map((value) => (
              <div key={value.title} className="probee-value">
                <span className="probee-value-number">{value.eyebrow}</span>
                <div>
                  <h2 className="text-lg font-semibold">{value.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="probee-section">
        <Container>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="probee-label">Featured collection</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Curated for the way you buy.
              </h2>
            </div>
            <Link
              href="/products"
              className="probee-focus-ring w-fit rounded-full border border-[var(--probee-border-default)] px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-[var(--probee-gold-border)] hover:text-[var(--probee-gold)]"
            >
              View all products ↗
            </Link>
          </div>

          <div className="mt-10">
            <ProductGrid products={featuredProducts} />
          </div>
        </Container>
      </section>

      <section id="categories" className="probee-dark-section">
        <Container className="probee-section">
          <div className="max-w-3xl">
            <p className="probee-label">Explore the ecosystem</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              One premium home for every ProBee package.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
              Categories stay connected to the live catalog, so the experience
              can grow without rebuilding the storefront.
            </p>
          </div>
          <div className="mt-10">
            <CategoryGrid categories={categories} />
          </div>
        </Container>
      </section>

      <section id="why-probee" className="probee-section">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
            <div>
              <p className="probee-label">The ProBee standard</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
                Premium on the surface.
                <span className="probee-gold-text block">Power underneath.</span>
              </h2>
            </div>
            <div className="probee-glow-panel rounded-[2rem] p-7 sm:p-10">
              <div className="flex items-center gap-4">
                <BrandMark className="text-xl" />
                <span className="h-px flex-1 bg-[var(--probee-gold-border)]" />
              </div>
              <p className="mt-7 text-lg leading-8 text-text-secondary">
                ProBee is being shaped as more than a storefront: a secure
                commerce foundation ready for intelligent customer service,
                automated sales, fulfillment and marketing.
              </p>
              <Link
                href="/products"
                className="probee-focus-ring mt-8 inline-flex items-center text-sm font-semibold text-[var(--probee-gold)] hover:text-gold-hover"
              >
                Start exploring <span className="ml-2">→</span>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-[var(--probee-border-subtle)] bg-surface-1">
        <Container className="probee-section">
          <div className="probee-cta-panel">
            <div className="relative z-10 max-w-3xl">
              <p className="probee-label">Your next move</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
                Find the package that fits.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary">
                Explore the live ProBee catalog and compare the options that
                matter before you buy.
              </p>
              <Link
                href="/products"
                className="probee-primary-button probee-focus-ring mt-8 inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold"
              >
                Explore products ↗
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
