import Image from "next/image";
import Link from "next/link";
import { Surface } from "@/components/ui";
import { formatProductPrice, formatDuration } from "@/lib/catalog/format";
import type { CatalogProduct } from "@/lib/catalog/types";

interface ProductCardProps {
  product: CatalogProduct;
  priority?: boolean;
}

export function ProductCard({
  product,
  priority = false,
}: ProductCardProps) {
  const price = formatProductPrice(product);
  const planCount = product.plans.length;
  const firstPlanDuration = product.plans[0]
    ? formatDuration(product.plans[0].duration, product.plans[0].durationUnit)
    : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-[var(--probee-radius-lg)] probee-focus-ring"
    >
      <Surface
        tone="interactive"
        className="h-full overflow-hidden p-0"
      >
        <div className="relative aspect-[4/3] overflow-hidden border-b border-[var(--probee-border-subtle)] bg-surface-2">
          {product.coverUrl ? (
            <Image
              src={product.coverUrl}
              alt=""
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
              priority={priority}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(185,160,106,0.09),transparent_42%)]">
              <span className="text-sm tracking-[0.18em] text-text-muted">
                ProBee
              </span>
            </div>
          )}

          {product.featured ? (
            <span className="absolute left-3 top-3 rounded-full border border-[var(--probee-border-default)] bg-background/85 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-gold backdrop-blur">
              Featured
            </span>
          ) : null}
        </div>

        <div className="p-5">
          {product.category ? (
            <p className="probee-label">{product.category.name}</p>
          ) : null}

          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            {product.name}
          </h3>

          {product.shortDescription ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-muted">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--probee-border-subtle)] pt-4">
            <div>
              <p className="probee-caption">Options</p>
              <p className="mt-1 text-sm text-text-secondary">
                {planCount > 0
                  ? `${planCount} plan${planCount === 1 ? "" : "s"}`
                  : "Flexible plans"}
                {firstPlanDuration ? ` · from ${firstPlanDuration}` : ""}
              </p>
            </div>

            <div className="text-right">
              <p className="probee-caption">Price</p>
              <p className="mt-1 text-sm font-semibold text-gold">
                {price ?? "Configured in catalog"}
              </p>
            </div>
          </div>
        </div>
      </Surface>
    </Link>
  );
}
