import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("transactional email regression contracts", () => {
  it("keeps the fixed event set and deterministic idempotency keys", () => {
    const types = read("src/lib/email/types.ts");
    const server = read("src/lib/email/server.ts");

    for (const event of [
      "account_activation",
      "password_reset",
      "order_created",
      "payment_submitted",
      "payment_paid",
      "payment_rejected",
      "digital_entitlement_ready",
    ]) {
      expect(types).toContain(event);
    }

    expect(server).toContain("function idempotencyKey");
    expect(server).toContain('request.event + ":" + sourceId(request)');
    expect(server).toContain("alreadySent");
    expect(server).toContain("inProgress");
    expect(server).toContain("EMAIL_RETRY_LIMIT_REACHED");
  });

  it("uses a server-only API key and provider idempotency header", () => {
    const provider = read("src/lib/email/provider.ts");
    expect(provider).toContain("process.env.EMAIL_API_KEY");
    expect(provider).not.toContain("NEXT_PUBLIC_EMAIL_API_KEY");
    expect(provider).toContain('"Idempotency-Key"');
  });

  it("keeps provider disabled behavior explicit", () => {
    const provider = read("src/lib/email/provider.ts");
    expect(provider).toContain('provider === "none"');
    expect(provider).toContain("EMAIL_PROVIDER_NOT_CONFIGURED");
  });
});

describe("auth regression contracts", () => {
  it("keeps password recovery validation type-safe and preserves its default destination", () => {
    const actions = read("src/app/auth/actions.ts");
    const confirm = read("src/app/auth/confirm/route.ts");

    expect(actions).toContain("isValidEmail(email)");
    expect(actions).not.toContain("EMAIL_PATTERN.test(email)");
    expect(confirm).toContain(
      'request.nextUrl.searchParams.get("next") ?? defaultNext',
    );
  });

  it("keeps safe next-path validation centralized", () => {
    const urls = read("src/lib/auth/urls.ts");
    const callback = read("src/app/auth/callback/route.ts");
    const confirm = read("src/app/auth/confirm/route.ts");

    expect(urls).toContain("function safeNextPath");
    expect(urls).toContain('value.startsWith("//")');
    expect(urls).toContain('value.includes("?")');
    expect(urls).toContain('value.includes("#")');
    expect(callback).toContain("safeNextPath");
    expect(confirm).toContain("safeNextPath");
  });

  it("keeps account/admin authentication server-side", () => {
    const adminLayout = read("src/app/admin/layout.tsx");
    const adminAuth = read("src/lib/admin/auth.ts");
    const accountPage = read("src/app/(store)/account/page.tsx");

    expect(adminLayout).toContain("requireStaff");
    expect(adminAuth).toContain("current_user_is_staff");
    expect(accountPage).toContain("getUser");
  });
});

describe("error and loading boundary inventory", () => {
  const files = [
    "src/app/admin/error.tsx",
    "src/app/admin/loading.tsx",
    "src/app/admin/categories/loading.tsx",
    "src/app/admin/customers/loading.tsx",
    "src/app/admin/orders/loading.tsx",
    "src/app/admin/reviews/loading.tsx",
    "src/app/admin/settings/loading.tsx",
    "src/app/(store)/account/loading.tsx",
    "src/app/(store)/account/orders/loading.tsx",
    "src/app/(store)/account/orders/[orderReference]/loading.tsx",
    "src/app/(store)/account/digital-products/loading.tsx",
  ];

  for (const file of files) {
    it(`keeps boundary ${file} present`, () => {
      expect(read(file).length).toBeGreaterThan(0);
    });
  }
});
