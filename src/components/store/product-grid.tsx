import { LoadingState } from "@/components/ui";
import type { CatalogProduct } from "@/lib/catalog/types";
import { EmptyState } from "./empty-state";
import { ProductCard } from "./product-card";

interface ProductGridProps {
  products?: CatalogProduct[];
  loading?: boolean;
}

export function ProductGrid({
  products = [],
  loading = false,
}: ProductGridProps) {
  if (loading) {
    return (
      <div
        className="flex min-h-52 items-center justify-center"
        aria-busy="true"
        aria-live="polite"
      >
        <LoadingState label="Loading catalog" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="No published products yet"
        description="Published catalog items will appear here once they are available from the product management layer."
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
