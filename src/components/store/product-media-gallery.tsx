"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ProductMedia } from "@/lib/catalog/types";

interface ProductMediaGalleryProps {
  productName: string;
  coverUrl?: string;
  media?: ProductMedia[];
}

export function ProductMediaGallery({
  productName,
  coverUrl,
  media = [],
}: ProductMediaGalleryProps) {
  const items = useMemo(() => {
    const cover = coverUrl
      ? [{ id: "cover", url: coverUrl, alt: productName, kind: "image" as const }]
      : [];

    return [...cover, ...media].filter(
      (item, index, collection) =>
        collection.findIndex((candidate) => candidate.url === item.url) === index,
    );
  }, [coverUrl, media, productName]);

  const [selectedUrl, setSelectedUrl] = useState(items[0]?.url);

  const selected = items.find((item) => item.url === selectedUrl) ?? items[0];

  if (!selected) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-[var(--radius-xl)] border border-[var(--probee-border-subtle)] bg-surface-1">
        <span className="text-sm text-text-muted">Product media will appear here.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-xl)] border border-[var(--probee-border-subtle)] bg-surface-1">
        {selected.kind === "video" ? (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            Video preview prepared for a future media provider.
          </div>
        ) : (
          <Image
            src={selected.url}
            alt={selected.alt ?? productName}
            fill
            className="object-contain"
            sizes="(min-width: 1024px) 50vw, 100vw"
            unoptimized
          />
        )}
      </div>

      {items.length > 1 ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          aria-label="Product media thumbnails"
        >
          {items.map((item) => {
            const active = item.url === selected.url;

            return (
              <button
                type="button"
                key={item.id}
                className="probee-focus-ring relative size-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] border bg-surface-1 transition-colors sm:size-24"
                style={{
                  borderColor: active
                    ? "var(--probee-gold)"
                    : "var(--probee-border-subtle)",
                }}
                aria-label={`View ${item.alt ?? productName}`}
                aria-pressed={active}
                onClick={() => setSelectedUrl(item.url)}
              >
                {item.kind === "video" ? (
                  <span className="flex size-full items-center justify-center text-xs text-text-muted">
                    Video
                  </span>
                ) : (
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                    unoptimized
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
