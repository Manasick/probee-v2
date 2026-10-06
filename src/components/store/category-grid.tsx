import type { CatalogCategory } from "@/lib/catalog/types";
import { EmptyState } from "./empty-state";
import { CategoryCard } from "./category-card";

interface CategoryGridProps {
  categories?: CatalogCategory[];
}

export function CategoryGrid({
  categories = [],
}: CategoryGridProps) {
  if (categories.length === 0) {
    return (
      <EmptyState
        title="Categories are ready for catalog setup"
        description="Admin-managed categories will appear here as soon as the catalog layer is populated."
      />
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}
