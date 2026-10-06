import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  isValidEmail,
  normalizeEmail,
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/auth/validation";
import { safeNextPath } from "@/lib/auth/urls";
import {
  formatDuration,
  formatPrice,
  formatProductPrice,
  getPlanPriceRange,
} from "@/lib/catalog/format";
import {
  getOrderStatusMeta,
  getPaymentStatusMeta,
  getPaymentMethodLabel,
  isPaymentEligibleOrderStatus,
} from "@/lib/orders/presentation";
import {
  hasAllowedPaymentMimeType,
  PAYMENT_PROOF_MAX_BYTES,
  sanitizePaymentFilename,
} from "@/lib/payments/validation";
import {
  isUuid,
  normalizeKeyValueItems,
  sanitizeSearchTerm,
  slugifyProductName,
  validateAdminProductPlanInput,
  validateKeyValueObject,
  validateTextArray,
} from "@/lib/admin/validation";
import type { AdminProductPlanInput } from "@/lib/catalog/types";

const basePlan: AdminProductPlanInput = {
  name: "Standard",
  slug: "standard",
  description: "",
  billingType: "one_time",
  billingInterval: "",
  billingIntervalCount: null,
  price: 10,
  currency: "USD",
  duration: 30,
  durationUnit: "day",
  renewalAvailable: false,
  warrantyDuration: null,
  warrantyUnit: "",
  seats: null,
  invites: null,
  participants: null,
  features: ["Feature"],
  deliveryType: "digital",
  deliveryDetails: "",
  requiresCustomerEmail: false,
  customerRequirements: [],
  customAttributes: {},
  active: true,
  sortOrder: 0,
};

const productId = "00000000-0000-4000-8000-000000000001";

describe("authentication validation", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("validates email shape", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("enforces password length", () => {
    expect(validatePassword("x".repeat(MIN_PASSWORD_LENGTH - 1))).toBeTruthy();
    expect(validatePassword("x".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    expect(validatePassword("x".repeat(MAX_PASSWORD_LENGTH + 1))).toBeTruthy();
  });

  it("validates password confirmation", () => {
    expect(validatePasswordConfirmation("secret123", "secret123")).toBeNull();
    expect(validatePasswordConfirmation("secret123", "different")).toBe("Passwords do not match.");
  });
});

describe("safe redirects", () => {
  it("allows account and admin internal paths only", () => {
    expect(safeNextPath("/account/orders")).toBe("/account/orders");
    expect(safeNextPath("/admin/settings")).toBe("/admin/settings");
  });

  it("rejects external and ambiguous redirect targets", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "javascript:alert(1)",
      "/account?next=https://evil.example",
      "/account#fragment",
      "/outside",
      null,
    ]) {
      expect(safeNextPath(value)).toBe("/account");
    }
  });
});

describe("catalog formatting", () => {
  it("formats prices and durations", () => {
    expect(formatPrice(10, "USD")).toBe("$10.00");
    expect(formatDuration(1, "days")).toBe("1 day");
    expect(formatDuration(2, "days")).toBe("2 days");
    expect(formatDuration(0, "days")).toBeNull();
  });

  it("handles single and multi-currency plan ranges", () => {
    expect(
      getPlanPriceRange([
        { id: "1", name: "A", price: 10, currency: "USD" },
        { id: "2", name: "B", price: 20, currency: "USD" },
      ]),
    ).toEqual({ min: 10, max: 20, currency: "USD" });

    const multiCurrency = formatProductPrice({
      id: productId,
      name: "Product",
      slug: "product",
      active: true,
      published: true,
      plans: [
        { id: "1", name: "A", price: 10, currency: "USD" },
        { id: "2", name: "B", price: 20, currency: "EUR" },
      ],
    });

    expect(multiCurrency).toBe("Multiple currencies");
  });

  it("returns null for an unusable plan set", () => {
    expect(
      getPlanPriceRange([
        { id: "1", name: "A", price: Number.NaN, currency: "USD" },
      ]),
    ).toBeNull();
  });
});

describe("order and payment presentation", () => {
  it("falls back safely for unknown statuses", () => {
    expect(getOrderStatusMeta("unknown").label).toBe("Pending");
    expect(getPaymentStatusMeta("unknown").label).toBe("Pending verification");
  });

  it("maps payment methods safely", () => {
    expect(getPaymentMethodLabel("manual_bank_transfer")).toBe("Manual bank transfer");
    expect(getPaymentMethodLabel("unknown")).toBe("Not selected");
  });

  it("keeps payment eligibility explicit", () => {
    expect(isPaymentEligibleOrderStatus("pending")).toBe(true);
    expect(isPaymentEligibleOrderStatus("processing")).toBe(true);
    expect(isPaymentEligibleOrderStatus("cancelled")).toBe(false);
    expect(isPaymentEligibleOrderStatus("refunded")).toBe(false);
    expect(isPaymentEligibleOrderStatus("completed")).toBe(false);
  });

  it("formats currency safely", () => {
    expect(typeof getOrderStatusMeta("pending").classes).toBe("string");
  });
});

describe("payment proof validation", () => {
  it("accepts only configured MIME types", () => {
    expect(hasAllowedPaymentMimeType("image/jpeg")).toBe(true);
    expect(hasAllowedPaymentMimeType("application/pdf")).toBe(true);
    expect(hasAllowedPaymentMimeType("text/html")).toBe(false);
  });

  it("sanitizes filenames without inventing empty names", () => {
    expect(sanitizePaymentFilename("  proof\n.png  ")).toBe("proof.png");
    expect(sanitizePaymentFilename("\u0000")).toBeNull();
  });

  it("keeps the proof size cap bounded", () => {
    expect(PAYMENT_PROOF_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("admin validation", () => {
  it("validates UUIDs and stable slugs", () => {
    expect(isUuid(productId)).toBe(true);
    expect(slugifyProductName("Crème & Cloud!")).toBe("creme-cloud");
  });

  it("validates a normal plan", () => {
    expect(validateAdminProductPlanInput(basePlan)).toBeNull();
  });

  it("rejects invalid subscription metadata", () => {
    expect(
      validateAdminProductPlanInput({
        ...basePlan,
        billingType: "subscription",
        billingInterval: "",
        billingIntervalCount: null,
      }),
    ).toContain("needs a billing interval");

    expect(
      validateAdminProductPlanInput({
        ...basePlan,
        billingType: "one_time",
        billingInterval: "month",
        billingIntervalCount: 1,
      }),
    ).toContain("cannot have subscription interval");
  });

  it("rejects invalid duration and warranty data", () => {
    expect(
      validateAdminProductPlanInput({
        ...basePlan,
        duration: null,
        durationUnit: "day",
      }),
    ).toContain("cannot have a duration unit");

    expect(
      validateAdminProductPlanInput({
        ...basePlan,
        warrantyDuration: 0,
        warrantyUnit: "day",
      }),
    ).toContain("invalid warranty");
  });

  it("rejects unsafe custom attribute keys and malformed arrays", () => {
    const reservedKeyObject = JSON.parse(`{"__proto__":"x"}`) as Record<string, unknown>;
    expect(validateKeyValueObject(reservedKeyObject)).toBe(false);
    expect(validateKeyValueObject({ constructor: "x" })).toBe(false);
    expect(validateTextArray(["ok", ""])).toBe(false);
    expect(validateTextArray(["x".repeat(121)], 120)).toBe(false);
  });

  it("normalizes key/value items and rejects duplicates", () => {
    expect(
      normalizeKeyValueItems([
        { id: productId, key: "color", value: "black" },
        { id: productId, key: "size", value: "large" },
      ]),
    ).toEqual({ color: "black", size: "large" });

    expect(
      normalizeKeyValueItems([
        { id: productId, key: "color", value: "black" },
        { id: productId, key: "color", value: "gold" },
      ]),
    ).toBeNull();
  });

  it("sanitizes search terms", () => {
    expect(sanitizeSearchTerm("hello<script>world!!!")).toBe("hello script world");
  });
});
