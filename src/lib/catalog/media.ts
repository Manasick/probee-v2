export const PRODUCT_MEDIA_BUCKET = "product-media";
export const MAX_PRODUCT_MEDIA_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_PRODUCT_MEDIA_ITEMS = 30;

export const PRODUCT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProductImageMimeType = (typeof PRODUCT_IMAGE_MIME_TYPES)[number];

export function isSupportedProductImageMimeType(
  value: string,
): value is ProductImageMimeType {
  return (PRODUCT_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function getProductImageExtension(
  mimeType: ProductImageMimeType,
): "jpg" | "png" | "webp" {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}

export function isSafeProductMediaPath(
  productId: string,
  storagePath: string,
): boolean {
  const escapedProductId = productId.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    "^products/" +
      escapedProductId +
      "/[A-Za-z0-9][A-Za-z0-9._-]*\\.(jpg|jpeg|png|webp)$",
    "i",
  );

  return pattern.test(storagePath);
}

export function getProductMediaPath(
  productId: string,
  mimeType: ProductImageMimeType,
): string {
  return (
    "products/" +
    productId +
    "/" +
    crypto.randomUUID() +
    "." +
    getProductImageExtension(mimeType)
  );
}
