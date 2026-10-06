import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("API route regression contracts", () => {
  it("requires authentication and idempotency before checkout mutation", () => {
    const source = read("src/app/api/checkout/route.ts");
    expect(source).toContain('if (!user)');
    expect(source).toContain('request.headers.get("Idempotency-Key")');
    expect(source).toContain('"checkout:cart_empty"');
    expect(source).toContain('body.items.length > 50');
    expect(source).toContain("value.quantity <= 99");
    expect(source).toContain("create_checkout_order");
  });

  it("keeps customer payment input validation before storage mutation", () => {
    const source = read("src/app/api/payments/manual-bank-transfer/route.ts");
    const referenceCheck = source.indexOf('paymentReference.length < 2');
    const sizeCheck = source.indexOf("fileValue.size <= 0");
    const signatureCheck = source.indexOf("const extension = signatureMatches(bytes)");
    const uploadCall = source.indexOf('.from("payment-proofs")\n    .upload(');

    expect(referenceCheck).toBeGreaterThan(-1);
    expect(sizeCheck).toBeGreaterThan(referenceCheck);
    expect(signatureCheck).toBeGreaterThan(sizeCheck);
    expect(uploadCall).toBeGreaterThan(signatureCheck);
    expect(source).toContain("p_file_sha256: fileSha256");
  });

  it("fails safely when digital authorization or signed URL generation fails", () => {
    const source = read("src/app/api/digital-delivery/[entitlementId]/[assetId]/route.ts");
    expect(source).toContain('status: 401');
    expect(source).toContain('status: 404');
    expect(source).toContain('status: 503');
    expect(source).toContain('createSignedUrl(storagePath, 60)');
  });

  it("keeps transactional emails asynchronous from critical request paths", () => {
    for (const path of [
      "src/app/api/checkout/route.ts",
      "src/app/api/payments/manual-bank-transfer/route.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("after(() =>");
      expect(source).toContain("sendTransactionalEmail");
    }
  });
});

describe("critical route inventory", () => {
  const routes = [
    "src/app/api/cart/rehydrate/route.ts",
    "src/app/api/checkout/route.ts",
    "src/app/api/payments/manual-bank-transfer/route.ts",
    "src/app/api/digital-delivery/[entitlementId]/[assetId]/route.ts",
    "src/app/auth/callback/route.ts",
    "src/app/auth/confirm/route.ts",
  ];

  for (const route of routes) {
    it(`keeps route ${route} present`, () => {
      expect(readFileSync(join(root, route), "utf8").length).toBeGreaterThan(0);
    });
  }
});

describe("major route-boundary inventory", () => {
  const routes = [
    "src/app/(store)/page.tsx",
    "src/app/(store)/products/page.tsx",
    "src/app/(store)/products/[slug]/page.tsx",
    "src/app/(store)/cart/page.tsx",
    "src/app/(store)/checkout/page.tsx",
    "src/app/(store)/payment/page.tsx",
    "src/app/(store)/account/page.tsx",
    "src/app/(store)/account/orders/page.tsx",
    "src/app/(store)/account/orders/[orderReference]/page.tsx",
    "src/app/(store)/account/digital-products/page.tsx",
    "src/app/(store)/account/reviews/page.tsx",
    "src/app/admin/page.tsx",
    "src/app/admin/products/page.tsx",
    "src/app/admin/products/new/page.tsx",
    "src/app/admin/products/[id]/page.tsx",
    "src/app/admin/categories/page.tsx",
    "src/app/admin/orders/page.tsx",
    "src/app/admin/orders/[id]/page.tsx",
    "src/app/admin/payments/page.tsx",
    "src/app/admin/customers/page.tsx",
    "src/app/admin/customers/[id]/page.tsx",
    "src/app/admin/reviews/page.tsx",
    "src/app/admin/digital-delivery/page.tsx",
    "src/app/admin/digital-delivery/assets/page.tsx",
    "src/app/admin/email-activity/page.tsx",
    "src/app/admin/settings/page.tsx",
  ];

  for (const route of routes) {
    it(`keeps ${route} present`, () => {
      expect(readFileSync(join(root, route), "utf8").length).toBeGreaterThan(0);
    });
  }
});
