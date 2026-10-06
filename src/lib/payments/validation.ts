export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_REFERENCE_MAX_LENGTH = 100;
export const PAYMENT_FILENAME_MAX_LENGTH = 255;

export const PAYMENT_PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const PAYMENT_PROOF_EXTENSIONS: Record<
  (typeof PAYMENT_PROOF_MIME_TYPES)[number],
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function sanitizePaymentFilename(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  return cleaned ? cleaned.slice(0, PAYMENT_FILENAME_MAX_LENGTH) : null;
}

export function hasAllowedPaymentMimeType(
  value: string,
): value is (typeof PAYMENT_PROOF_MIME_TYPES)[number] {
  return PAYMENT_PROOF_MIME_TYPES.includes(
    value as (typeof PAYMENT_PROOF_MIME_TYPES)[number],
  );
}
