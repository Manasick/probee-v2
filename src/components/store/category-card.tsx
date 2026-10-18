import Image from "next/image";
import Link from "next/link";
import { Surface } from "@/components/ui";
import type { CatalogCategory } from "@/lib/catalog/types";

interface CategoryCardProps {
  category: CatalogCategory;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="probee-category-card group block rounded-[var(--probee-radius-lg)] probee-focus-ring"
    >
      <Surface tone="interactive" className="probee-category-surface h-full overflow-hidden p-0">
        <div className="probee-category-media relative aspect-[16/9] overflow-hidden bg-surface-2">
          {category.coverUrl ? (
            <Image
              src={category.coverUrl}
              alt={category.name}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] group-focus-visible:scale-[1.03]"
              sizes="(min-width: 1024px) 33vw, 100vw"
              unoptimized
            />
          ) : (
            <div className="h-full bg-[linear-gradient(135deg,rgba(185,160,106,0.09),transparent_55%)]" />
          )}
          <div className="probee-category-image-shade" aria-hidden="true" />
          <span className="probee-category-arrow absolute bottom-3 right-3" aria-hidden="true">↗</span>
        </div>
        <div className="flex h-full items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="probee-label mb-2">Explore category</p>
            <h3 className="text-lg font-semibold transition-colors group-hover:text-gold group-focus-visible:text-gold">{category.name}</h3>
            {category.description ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-muted">
                {category.description}
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-text-muted">Browse products in this collection.</p>
            )}
          </div>
          <span className="sr-only">View {category.name} products</span>
        </div>
      </Surface>
    </Link>
  );
}
