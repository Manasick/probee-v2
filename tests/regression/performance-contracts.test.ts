import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("production performance contracts", () => {
  it("keeps public catalog queries bounded and parallelized", () => {
    const source = read("src/lib/catalog/server.ts");
    expect(source).toContain(".limit(safeLimit)");
    expect(source).toContain("Promise.all([");
    expect(source).toContain("new Set(");
  });

  it("deduplicates product metadata/detail rendering within a request", () => {
    const source = read("src/lib/catalog/server.ts");
    expect(source).toContain('import { cache } from "react";');
    expect(source).toContain("getPublicCatalogProductBySlug = cache(");
  });

  it("avoids duplicate product-media database reads on product detail", () => {
    const source = read("src/lib/catalog/server.ts");
    const mediaSelectCount =
      source.split('.from("product-media")\n      .select(').length - 1;
    expect(mediaSelectCount).toBe(1);
    expect(source).toContain("includeMedia = false");
  });

  it("uses batched signed URLs for private catalog media", () => {
    const source = read("src/lib/catalog/server.ts");
    expect(source).toContain("createSignedUrls(paths, 60 * 60 * 24)");
    expect(source).toContain("createSignedUrls(primaryPaths, 60 * 60 * 24)");
    expect(source).not.toContain("createSignedUrl(row.media_url");
  });

  it("keeps product images on Next.js optimized delivery", () => {
    const card = read("src/components/store/product-card.tsx");
    const gallery = read("src/components/store/product-media-gallery.tsx");
    expect(card).not.toContain("unoptimized");
    expect(gallery).not.toContain("unoptimized");
    expect(card).toContain("priority={priority}");
    expect(gallery).toContain("priority");
  });

  it("adds production-safe HTTP hardening without a broad CSP", () => {
    const config = read("next.config.ts");
    expect(config).toContain("poweredByHeader: false");
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("Referrer-Policy");
    expect(config).toContain("Permissions-Policy");
    expect(config).not.toContain("Content-Security-Policy");
  });

  it("keeps production metadata based on the configured site URL", () => {
    const rootLayout = read("src/app/layout.tsx");
    expect(rootLayout).toContain("metadataBase: new URL(getSiteUrl())");
    expect(rootLayout).toContain('template: "%s | ProBee"');
  });

  it("keeps CI install reproducibility lockfile-aware without requiring secrets", () => {
    const workflow = read(".github/workflows/step19-regression.yml");
    expect(workflow).toContain("if [ -f package-lock.json ]");
    expect(workflow).toContain("npm ci --no-audit --no-fund");
    expect(workflow).toContain("npm install --no-audit --no-fund");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE");
  });

  it("keeps deployment documentation explicit about the current no-lockfile blocker", () => {
    const readme = read("README.md");
    expect(readme).toContain("currently has no lockfile");
    expect(readme).toContain("Do not treat those as passed");
    expect(readme).toContain("Supabase");
    expect(readme).toContain("Storage");
  });
});
