import { Container } from "@/components/ui";
import { CatalogControls } from "@/components/store/catalog-controls";
import { ProductGrid } from "@/components/store/product-grid";
import {
  getPublicCatalogCategories,
  getPublicCatalogProducts,
} from "@/lib/catalog/server";

export const revalidate = 300;

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    getPublicCatalogProducts(24),
    getPublicCatalogCategories(),
  ]);

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Products</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Explore the ProBee catalog.
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Products and their storefront media are loaded from the protected
            catalog data layer.
          </p>
        </div>

        <div className="mt-8">
          <CatalogControls categories={categories} />
        </div>

        <div className="mt-8">
          <ProductGrid products={products} />
        </div>
      </Container>
    </section>
  );
}
