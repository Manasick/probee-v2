export const DIGITAL_DELIVERY_BUCKET = "digital-products";
export const MAX_DIGITAL_ASSET_BYTES = 50 * 1024 * 1024;

export const DIGITAL_ASSET_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export type DigitalAssetMimeType = (typeof DIGITAL_ASSET_MIME_TYPES)[number];

const MIME_BY_EXTENSION: Record<string, DigitalAssetMimeType> = {
  pdf: "application/pdf",
  zip: "application/zip",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function isSupportedDigitalAssetMimeType(value: string): value is DigitalAssetMimeType {
  return DIGITAL_ASSET_MIME_TYPES.includes(value as DigitalAssetMimeType);
}

export function isSafeDigitalAssetPath(productId: string, storagePath: string): boolean {
  return new RegExp(
    "^digital-products/" + productId + "/[0-9a-f-]{36}\\.(pdf|zip|txt|csv|jpg|jpeg|png|webp|docx|xlsx|pptx)$",
    "i",
  ).test(storagePath);
}

export function mimeMatchesPath(mimeType: DigitalAssetMimeType, storagePath: string): boolean {
  const extension = storagePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] === mimeType;
}

export function hasSupportedSignature(bytes: Uint8Array, mimeType: DigitalAssetMimeType): boolean {
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }

  if (mimeType === "application/zip" || mimeType.includes("openxmlformats-officedocument")) {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }

  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
      String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
    );
  }

  return mimeType === "text/plain" || mimeType === "text/csv";
}

export function formatDigitalAssetSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024 * 1024) return Math.max(1, Math.ceil(bytes / 1024)) + " KB";
  return (
    (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1) +
    " MB"
  );
}