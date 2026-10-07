import { Container } from "@/components/ui";
import { CatalogControls } from "@/components/store/catalog-controls";
import { ProductGrid } from "@/components/store/product-grid";
import { getPublicCatalogCategories, getPublicCatalogProducts } from "@/lib/catalog/server";

export const revalidate = 300;

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    getPublicCatalogProducts(24),
    getPublicCatalogCategories(),
  ]);

  return (
    <section className="probee-section probee-products-page">
      <Container>
        <div className="probee-products-hero">
          <div className="max-w-3xl">
            <p className="probee-label">The ProBee Collection</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
              Choose your <span className="probee-gold-text">advantage.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
              Explore premium digital products, plans and packages — with every option,
              duration and benefit presented from the live ProBee catalog.
            </p>
          </div>
          <div className="probee-products-stat" aria-label={`${products.length} products currently displayed`}>
            <span>{String(products.length).padStart(2, "0")}</span>
            <small>Published<br />products</small>
          </div>
        </div>

        <div className="mt-10 probee-catalog-toolbar">
          <CatalogControls categories={categories} />
        </div>

        <div className="mt-10">
          <ProductGrid products={products} />
        </div>
      </Container>
    </section>
  );
}
