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
      className="group block rounded-[var(--probee-radius-lg)] probee-focus-ring"
    >
      <Surface tone="interactive" className="overflow-hidden p-0">
        <div className="relative aspect-[16/9] bg-surface-2">
          {category.coverUrl ? (
            <Image
              src={category.coverUrl}
              alt={category.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              sizes="(min-width: 1024px) 33vw, 100vw"
              unoptimized
            />
          ) : (
            <div className="h-full bg-[linear-gradient(135deg,rgba(185,160,106,0.09),transparent_55%)]" />
          )}
        </div>
        <div className="p-5">
          <h3 className="text-lg font-semibold">{category.name}</h3>
          {category.description ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {category.description}
            </p>
          ) : null}
        </div>
      </Surface>
    </Link>
  );
}
