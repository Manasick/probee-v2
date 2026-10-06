import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const sourceDir = join(repoRoot, "src");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => join(migrationsDir, name));

const allSql = migrationFiles.map((path) => readFileSync(path, "utf8")).join("\n");
const securityHardening = read("supabase/migrations/20261006240000_security_rls_hardening.sql");

describe("repository security regression contracts", () => {
  it("contains the STEP 18 security hardening migration", () => {
    expect(existsSync(join(migrationsDir, "20261006240000_security_rls_hardening.sql"))).toBe(true);
  });

  it("keeps every SECURITY DEFINER function on an empty search_path", () => {
    const securityDefinerCount = (allSql.match(/\bsecurity\s+definer\b/gi) ?? []).length;
    const guardedSecurityDefiners =
      (allSql.match(/\bsecurity\s+definer\b[\s\S]{0,10000}?\bset\s+search_path\s*=\s*''/gi) ?? [])
        .length;
    expect(securityDefinerCount).toBeGreaterThan(0);
    expect(guardedSecurityDefiners).toBe(securityDefinerCount);
  });

  it("does not introduce broad true-valued RLS policies", () => {
    expect(allSql).not.toMatch(/\busing\s*\(\s*true\s*\)/i);
    expect(allSql).not.toMatch(/\bwith\s+check\s*\(\s*true\s*\)/i);
  });

  it("keeps critical direct table mutations revoked from authenticated users", () => {
    expect(allSql).toMatch(
      /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.orders,\s*public\.order_items,\s*public\.payments,\s*public\.payment_proofs,\s*public\.digital_entitlements\s+from\s+authenticated/i,
    );
  });

  it("keeps all storage buckets private", () => {
    const bucketBlocks =
      allSql.match(/insert\s+into\s+storage\.buckets[\s\S]{0,1000}?;/gi) ?? [];
    expect(bucketBlocks.length).toBeGreaterThanOrEqual(3);
    for (const block of bucketBlocks) {
      expect(block).toMatch(/\bpublic\b/i);
      expect(block).toMatch(/values\s*\([\s\S]*?\bfalse\b/i);
    }
  });

  it("requires active digital assets at the database and storage boundaries", () => {
    expect(securityHardening).toContain("a.is_active = true");
    expect(securityHardening).toContain("get_my_digital_asset_path");
    expect(securityHardening).toContain("can_read_digital_asset_storage");
    expect(securityHardening).toContain("and e.user_id = (select auth.uid())");
    expect(securityHardening).toContain("o.payment_status = 'paid'");
  });

  it("requires a real payment-proof storage object before acceptance", () => {
    expect(securityHardening).toContain("from storage.objects so");
    expect(securityHardening).toContain("so.bucket_id = 'payment-proofs'");
    expect(securityHardening).toContain("so.name = p_storage_path");
    expect(securityHardening).toContain("payment:proof_missing");
  });

  it("revalidates authoritative payment amount and currency during verification", () => {
    expect(securityHardening).toContain("v_payment.amount <> v_order.total");
    expect(securityHardening).toContain("v_payment.currency <> v_order.currency");
    expect(securityHardening).toContain("payment:amount_mismatch");
  });

  it("requires staff authorization for manual payment verification", () => {
    expect(securityHardening).toContain("if not private.is_staff() then");
    expect(securityHardening).toContain("payment:not_authorized");
  });

  it("preserves customer identity derivation from auth.uid()", () => {
    expect(securityHardening).toContain("v_user_id uuid := (select auth.uid())");
    expect(securityHardening).toContain("e.user_id = (select auth.uid())");
  });

  it("protects critical RPC execution privileges", () => {
    for (const functionName of [
      "create_checkout_order",
      "submit_manual_bank_payment",
      "verify_manual_bank_payment",
      "reject_manual_bank_payment",
      "get_my_digital_entitlements",
      "get_my_digital_asset_path",
      "create_product_review",
      "update_my_product_review",
      "set_review_moderation",
      "claim_transactional_email",
      "complete_transactional_email",
    ]) {
      expect(allSql).toMatch(new RegExp(`\\bfunction\\s+(?:public\\.)?${functionName}\\s*\\(`, "i"));
    }
  });

  it("does not expose server-only email secrets through public environment names", () => {
    const envExample = read(".env.example");
    const sourceFiles = [
      ...migrationFiles,
      ...walkFiles(sourceDir).filter((path) => /\.(ts|tsx|mjs)$/.test(path)),
    ];
    const source = [
      envExample,
      ...sourceFiles.map((path) => readFileSync(path, "utf8")),
    ].join("\n");

    expect(source).not.toContain("NEXT_PUBLIC_EMAIL_API_KEY");
    expect(source).not.toMatch(/supabase_service_role_key/i);
    expect(source).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/i);
  });

  it("preserves the digital entitlement security chain", () => {
    const digitalRoute = read("src/app/api/digital-delivery/[entitlementId]/[assetId]/route.ts");
    expect(digitalRoute).toContain("get_my_digital_asset_path");
    expect(digitalRoute).toContain('createSignedUrl(storagePath, 60)');
    expect(digitalRoute).toContain('status: 307');
    expect(digitalRoute).toContain('"Cache-Control": "no-store"');
  });

  it("preserves safe external-facing error behavior", () => {
    const adminError = read("src/app/admin/error.tsx");
    const digitalRoute = read("src/app/api/digital-delivery/[entitlementId]/[assetId]/route.ts");
    const paymentRoute = read("src/app/api/payments/manual-bank-transfer/route.ts");
    expect(adminError).not.toMatch(/<pre[^>]*>.*error\.stack/i);
    expect(digitalRoute).toContain("safeError");
    expect(paymentRoute).toContain("No payment status was changed.");
  });
});

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}
