import { afterEach, describe, expect, it } from "vitest";
import {
  DIGITAL_DELIVERY_BUCKET,
  DIGITAL_ASSET_MIME_TYPES,
  MAX_DIGITAL_ASSET_BYTES,
  formatDigitalAssetSize,
  hasSupportedSignature,
  isSafeDigitalAssetPath,
  isSupportedDigitalAssetMimeType,
  mimeMatchesPath,
} from "@/lib/digital-delivery/assets";
import { getEmailProviderStatus } from "@/lib/email/provider";

afterEach(() => {
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_REPLY_TO;
});

describe("digital-delivery validation", () => {
  it("keeps the digital bucket private by contract", () => {
    expect(DIGITAL_DELIVERY_BUCKET).toBe("digital-products");
    expect(MAX_DIGITAL_ASSET_BYTES).toBe(50 * 1024 * 1024);
  });

  it("accepts supported digital MIME types only", () => {
    expect(isSupportedDigitalAssetMimeType("application/pdf")).toBe(true);
    expect(isSupportedDigitalAssetMimeType("text/html")).toBe(false);
    expect(DIGITAL_ASSET_MIME_TYPES).toContain("application/zip");
  });

  it("validates safe product-scoped asset paths", () => {
    const productId = "00000000-0000-4000-8000-000000000001";
    expect(
      isSafeDigitalAssetPath(
        productId,
        `digital-products/${productId}/00000000-0000-4000-8000-000000000099.pdf`,
      ),
    ).toBe(true);
    expect(
      isSafeDigitalAssetPath(
        productId,
        "digital-products/other/00000000-0000-4000-8000-000000000099.pdf",
      ),
    ).toBe(false);
  });

  it("matches MIME types to file extensions", () => {
    expect(
      mimeMatchesPath(
        "application/pdf",
        "digital-products/x/00000000-0000-4000-8000-000000000099.pdf",
      ),
    ).toBe(true);
    expect(
      mimeMatchesPath(
        "application/pdf",
        "digital-products/x/00000000-0000-4000-8000-000000000099.zip",
      ),
    ).toBe(false);
  });

  it("recognizes signatures for supported binary formats", () => {
    expect(hasSupportedSignature(new Uint8Array([37, 80, 68, 70, 45]), "application/pdf")).toBe(true);
    expect(hasSupportedSignature(new Uint8Array([80, 75, 3, 4]), "application/zip")).toBe(true);
    expect(hasSupportedSignature(new Uint8Array([255, 216, 255]), "image/jpeg")).toBe(true);
    expect(hasSupportedSignature(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe(false);
  });

  it("treats text assets as signature-safe by policy", () => {
    expect(hasSupportedSignature(new Uint8Array(), "text/plain")).toBe(true);
    expect(hasSupportedSignature(new Uint8Array(), "text/csv")).toBe(true);
  });

  it("formats digital sizes safely", () => {
    expect(formatDigitalAssetSize(0)).toBe("Unknown size");
    expect(formatDigitalAssetSize(1024)).toBe("1 KB");
    expect(formatDigitalAssetSize(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("transactional email provider configuration", () => {
  it("treats EMAIL_PROVIDER=none as disabled", () => {
    process.env.EMAIL_PROVIDER = "none";
    expect(getEmailProviderStatus()).toEqual({
      provider: null,
      configured: false,
      reason: "No provider configured.",
    });
  });

  it("rejects unsupported providers", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    expect(getEmailProviderStatus().configured).toBe(false);
    expect(getEmailProviderStatus().reason).toBe("Unsupported provider.");
  });

  it("requires server-only Resend credentials", () => {
    process.env.EMAIL_PROVIDER = "resend";
    expect(getEmailProviderStatus().configured).toBe(false);

    process.env.EMAIL_API_KEY = "test-key";
    process.env.EMAIL_FROM = "no-reply@example.test";
    expect(getEmailProviderStatus().configured).toBe(true);
  });
});
