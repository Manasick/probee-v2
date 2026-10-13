"use client";

import { useMemo, useState } from "react";
import type { CatalogCategory, CatalogProduct } from "@/lib/catalog/types";
import { ProductGrid } from "@/components/store/product-grid";

interface CatalogBrowserProps {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  initialQuery?: string;
}

export function CatalogBrowser({ products, categories, initialQuery = "" }: CatalogBrowserProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevance");


  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = products.filter((product) => {
      const matchesQuery = !normalizedQuery || [
        product.name,
        product.shortDescription ?? "",
        product.fullDescription ?? "",
        product.category?.name ?? "",
        ...(product.features ?? []),
      ].join(" ").toLocaleLowerCase().includes(normalizedQuery);
      const matchesCategory = !category || product.category?.slug === category;
      return matchesQuery && matchesCategory;
    });

    return filtered.sort((a, b) => {
      if (sort === "catalog") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      const aPrice = Math.min(...a.plans.filter((plan) => plan.active !== false).map((plan) => plan.price), Number.POSITIVE_INFINITY);
      const bPrice = Math.min(...b.plans.filter((plan) => plan.active !== false).map((plan) => plan.price), Number.POSITIVE_INFINITY);
      if (sort === "price-low") return aPrice - bPrice;
      if (sort === "price-high") return bPrice - aPrice;
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [products, query, category, sort]);

  return (
    <>
      <div className="grid gap-3 rounded-[var(--probee-radius-xl)] border border-[var(--probee-border-subtle)] bg-surface-1 p-4 sm:grid-cols-[1.4fr_1fr_1fr] sm:p-5">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary" htmlFor="catalog-search">
            Search collection
          </label>
          <input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Product, feature, category..."
            className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary" htmlFor="catalog-category">
            Category
          </label>
          <select id="catalog-category" value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]">
            <option value="">All categories</option>
            {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary" htmlFor="catalog-sort">
            Sort collection
          </label>
          <select id="catalog-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]">
            <option value="relevance">Featured first</option>
            <option value="catalog">Catalog order</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-sm text-text-muted">
          Showing <span className="font-semibold text-text-primary">{visibleProducts.length}</span> of {products.length} products
        </p>
        {(query || category || sort !== "relevance") && (
          <button type="button" onClick={() => { setQuery(""); setCategory(""); setSort("relevance"); }} className="probee-focus-ring rounded-full border border-[var(--probee-border-default)] px-4 py-2 text-xs font-semibold text-text-secondary hover:border-[var(--probee-gold-border)] hover:text-[var(--probee-gold)]">
            Reset filters
          </button>
        )}
      </div>

      <div className="mt-6">
        {visibleProducts.length > 0 ? (
          <ProductGrid products={visibleProducts} />
        ) : (
          <div className="rounded-[var(--probee-radius-xl)] border border-[var(--probee-border-subtle)] bg-surface-1 px-6 py-14 text-center sm:px-10">
            <span className="probee-label">No matches found</span>
            <h2 className="mt-3 text-2xl font-semibold">Try a different search.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-muted">
              We couldn’t find products for those filters. Clear your search or choose another category to explore the collection.
            </p>
            <button type="button" onClick={() => { setQuery(""); setCategory(""); setSort("relevance"); }} className="probee-primary-button probee-focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}
