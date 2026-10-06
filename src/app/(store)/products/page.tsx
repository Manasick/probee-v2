import { Container } from "@/components/ui";
import { CatalogControls } from "@/components/store/catalog-controls";
import { ProductGrid } from "@/components/store/product-grid";

export default function ProductsPage() {
  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Products</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Explore the ProBee catalog.
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Products and plans will be rendered from the catalog data layer once
            it is populated.
          </p>
        </div>

        <div className="mt-8">
          <CatalogControls categories={[]} />
        </div>

        <div className="mt-8">
          <ProductGrid products={[]} />
        </div>
      </Container>
    </section>
  );
}
