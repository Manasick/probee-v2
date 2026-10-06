"use client";

import { useId } from "react";
import type { CatalogCategory } from "@/lib/catalog/types";

interface CatalogControlsProps {
  categories?: CatalogCategory[];
}

export function CatalogControls({
  categories = [],
}: CatalogControlsProps) {
  const searchId = useId();
  const categoryId = useId();
  const sortId = useId();

  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--probee-border-subtle)] bg-surface-1 p-4 sm:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary"
          htmlFor={searchId}
        >
          Search
        </label>
        <input
          id={searchId}
          type="search"
          placeholder="Search products"
          className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
        />
      </div>

      <div>
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary"
          htmlFor={categoryId}
        >
          Category
        </label>
        <select
          id={categoryId}
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
          htmlFor={sortId}
        >
          Sort
        </label>
        <select
          id={sortId}
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
