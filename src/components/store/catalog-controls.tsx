import type { CatalogCategory } from "@/lib/catalog/types";

interface CatalogControlsProps {
  categories?: CatalogCategory[];
}

export function CatalogControls({
  categories = [],
}: CatalogControlsProps) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--probee-border-subtle)] bg-surface-1 p-4 sm:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary"
          htmlFor="catalog-search"
        >
          Search
        </label>
        <input
          id="catalog-search"
          type="search"
          placeholder="Search products"
          className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
        />
      </div>

      <div>
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary"
          htmlFor="catalog-category"
        >
          Category
        </label>
        <select
          id="catalog-category"
          defaultValue=""
          className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary"
          htmlFor="catalog-sort"
        >
          Sort
        </label>
        <select
          id="catalog-sort"
          defaultValue="relevance"
          className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
        >
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>
      </div>
    </div>
  );
}
