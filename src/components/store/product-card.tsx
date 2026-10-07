import Image from "next/image";
import Link from "next/link";
import { Surface } from "@/components/ui";
import { formatDuration, formatProductPrice } from "@/lib/catalog/format";
import type { CatalogProduct } from "@/lib/catalog/types";

interface ProductCardProps { product: CatalogProduct; priority?: boolean; }

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const price = formatProductPrice(product);
  const planCount = product.plans.length;
  const firstPlanDuration = product.plans[0]
    ? formatDuration(product.plans[0].duration, product.plans[0].durationUnit)
    : null;

  return (
    <Link href={`/products/${product.slug}`} className="group block rounded-[var(--probee-radius-lg)] probee-focus-ring">
      <Surface tone="interactive" className="probee-product-card h-full overflow-hidden p-0">
        <div className="probee-product-media relative aspect-[4/3] overflow-hidden border-b border-[var(--probee-border-subtle)] bg-surface-2">
          <div className="probee-product-media-shine" aria-hidden="true" />
          {product.coverUrl ? (
            <Image
              src={product.coverUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
              priority={priority}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(185,160,106,0.13),transparent_48%)]">
              <span className="probee-product-placeholder">PROBEE</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" aria-hidden="true" />
          {product.featured ? (
            <span className="absolute left-4 top-4 rounded-full border border-[var(--probee-gold-border)] bg-black/55 px-3 py-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-gold backdrop-blur-md">
              Featured
            </span>
          ) : null}
          <span className="probee-product-arrow absolute bottom-4 right-4" aria-hidden="true">↗</span>
        </div>

        <div className="p-5 sm:p-6">
          {product.category ? <p className="probee-label">{product.category.name}</p> : null}
          <div className="mt-2 flex items-start justify-between gap-4">
            <h3 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-gold sm:text-[1.35rem]">{product.name}</h3>
            <span className="mt-1 hidden text-xs text-text-muted sm:block">View</span>
          </div>

          {product.shortDescription ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-muted">{product.shortDescription}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--probee-border-subtle)] pt-4">
            <div>
              <p className="probee-caption">Plans</p>
              <p className="mt-1 text-sm text-text-secondary">
                {planCount > 0 ? `${planCount} plan${planCount === 1 ? "" : "s"}` : "Flexible plans"}
                {firstPlanDuration ? ` · ${firstPlanDuration}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="probee-caption">Starting from</p>
              <p className="mt-1 text-base font-semibold text-gold">{price ?? "View options"}</p>
            </div>
          </div>
        </div>
      </Surface>
    </Link>
  );
}
