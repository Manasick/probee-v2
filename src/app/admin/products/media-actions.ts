"use server";

import type { AdminProductMedia } from "@/lib/catalog/types";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import {
  getProductImageExtension,
  isSafeProductMediaPath,
  isSupportedProductImageMimeType,
  MAX_PRODUCT_MEDIA_FILE_SIZE,
  MAX_PRODUCT_MEDIA_ITEMS,
  PRODUCT_MEDIA_BUCKET,
} from "@/lib/catalog/media";
import { isUuid } from "@/lib/admin/validation";

export interface ProductMediaActionState {
  ok: boolean;
  message: string;
  media?: AdminProductMedia;
  mediaId?: string;
  storagePath?: string;
  uploadToken?: string;
  recordDeactivated?: boolean;
}

const EMPTY_STATE: ProductMediaActionState = {
  ok: false,
  message: "",
};

function invalidFileMessage(): string {
  return "Only JPEG, PNG, and WebP images up to 5 MB are allowed.";
}

function mimeMatchesPath(
  mimeType: string,
  storagePath: string,
): boolean {
  const extension =
    storagePath.split(".").pop()?.toLowerCase() ?? "";

  return (
    (mimeType === "image/jpeg" &&
      (extension === "jpg" || extension === "jpeg")) ||
    (mimeType === "image/png" && extension === "png") ||
    (mimeType === "image/webp" && extension === "webp")
  );
}

function hasImageSignature(
  bytes: Uint8Array,
  mimeType: string,
): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return (
      bytes.length >= signature.length &&
      signature.every((value, index) => bytes[index] === value)
    );
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
      ) === "RIFF" &&
      String.fromCharCode(
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
      ) === "WEBP"
    );
  }

  return false;
}

function mapStorageError(
  message?: string | null,
): string {
  if (message?.toLowerCase().includes("not found")) {
    return "The media file could not be found.";
  }

  if (message?.toLowerCase().includes("already exists")) {
    return "A media object already exists at that path. Please retry the upload.";
  }

  return "The media storage operation could not be completed.";
}

function mapDatabaseError(
  error: { code?: string | null; message?: string | null },
): string {
  if (error.code === "23505") {
    return "This media file is already registered.";
  }

  if (error.code === "23514") {
    return "The media metadata does not satisfy the catalog rules.";
  }

  if (error.code === "23503") {
    return "The selected product could not be found.";
  }

  if (error.code === "42501") {
    return "You are not authorized to manage product media.";
  }

  return "The product media database operation could not be completed.";
}

async function ensureProductExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function countProductMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<number> {
  const { count } = await supabase
    .from("product_media")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  return count ?? 0;
}

function validateMetadata(
  altText: string,
  title: string,
  caption: string,
): string | null {
  if (altText.length > 180) {
    return "Alt text must be 180 characters or fewer.";
  }

  if (title.length > 180) {
    return "Media title must be 180 characters or fewer.";
  }

  if (caption.length > 500) {
    return "Media caption must be 500 characters or fewer.";
  }

  return null;
}

async function signMediaPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24);

  return error ? null : data?.signedUrl ?? null;
}

export async function prepareProductMediaUploadAction(
  productId: string,
  mimeType: string,
  size: number,
): Promise<ProductMediaActionState> {
  await requireStaff();

  if (!isUuid(productId)) {
    return { ...EMPTY_STATE, message: "The product reference is invalid." };
  }

  if (
    !isSupportedProductImageMimeType(mimeType) ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > MAX_PRODUCT_MEDIA_FILE_SIZE
  ) {
    return { ...EMPTY_STATE, message: invalidFileMessage() };
  }

  const supabase = await createClient();

  if (!(await ensureProductExists(supabase, productId))) {
    return { ...EMPTY_STATE, message: "The product could not be found." };
  }

  const currentCount = await countProductMedia(supabase, productId);

  if (currentCount >= MAX_PRODUCT_MEDIA_ITEMS) {
    return {
      ...EMPTY_STATE,
      message: "This product has reached the media limit.",
    };
  }

  const extension = getProductImageExtension(mimeType);
  const storagePath =
    "products/" +
    productId +
    "/" +
    crypto.randomUUID() +
    "." +
    extension;

  const { data, error } = await supabase.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.token) {
    return {
      ...EMPTY_STATE,
      message: mapStorageError(error?.message),
    };
  }

  return {
    ok: true,
    message: "Upload slot prepared.",
    storagePath,
    uploadToken: data.token,
  };
}

export async function registerProductMediaAction(
  productId: string,
  storagePath: string,
  mimeType: string,
  altText: string,
  title: string,
  caption: string,
): Promise<ProductMediaActionState> {
  await requireStaff();

  if (!isUuid(productId)) {
    return { ...EMPTY_STATE, message: "The product reference is invalid." };
  }

  if (
    !isSupportedProductImageMimeType(mimeType) ||
    !isSafeProductMediaPath(productId, storagePath) ||
    !mimeMatchesPath(mimeType, storagePath)
  ) {
    return {
      ...EMPTY_STATE,
      message: "The uploaded media reference is invalid.",
    };
  }

  const normalizedAlt = altText.trim();
  const normalizedTitle = title.trim();
  const normalizedCaption = caption.trim();
  const metadataError = validateMetadata(
    normalizedAlt,
    normalizedTitle,
    normalizedCaption,
  );

  if (metadataError) {
    return { ...EMPTY_STATE, message: metadataError };
  }

  const supabase = await createClient();

  if (!(await ensureProductExists(supabase, productId))) {
    return { ...EMPTY_STATE, message: "The product could not be found." };
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .download(storagePath);

  if (downloadError || !blob) {
    return {
      ...EMPTY_STATE,
      message:
        "The uploaded file could not be verified. The storage object was not registered.",
    };
  }

  if (blob.size <= 0 || blob.size > MAX_PRODUCT_MEDIA_FILE_SIZE) {
    await supabase.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .remove([storagePath]);

    return {
      ...EMPTY_STATE,
      message: invalidFileMessage(),
    };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (!hasImageSignature(bytes, mimeType)) {
    await supabase.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .remove([storagePath]);

    return {
      ...EMPTY_STATE,
      message:
        "The uploaded file did not match the selected image type and was rejected.",
    };
  }

  const currentCount = await countProductMedia(supabase, productId);

  if (currentCount >= MAX_PRODUCT_MEDIA_ITEMS) {
    await supabase.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .remove([storagePath]);

    return {
      ...EMPTY_STATE,
      message: "This product has reached the media limit.",
    };
  }

  const shouldBecomePrimary = currentCount === 0;

  const { data: inserted, error: insertError } = await supabase
    .from("product_media")
    .insert({
      product_id: productId,
      media_url: storagePath,
      media_type: "image",
      alt_text: normalizedAlt || null,
      title: normalizedTitle || null,
      caption: normalizedCaption || null,
      sort_order: currentCount,
      is_primary: false,
      is_active: true,
    })
    .select(
      "id,media_url,media_type,alt_text,title,caption,sort_order,is_primary,is_active",
    )
    .single();

  if (insertError || !inserted) {
    await supabase.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .remove([storagePath]);

    return {
      ...EMPTY_STATE,
      message: insertError
        ? mapDatabaseError(insertError)
        : "The media record could not be created.",
    };
  }

  if (shouldBecomePrimary) {
    const { error: primaryError } = await supabase.rpc(
      "set_product_media_primary",
      {
        p_product_id: productId,
        p_media_id: inserted.id,
      },
    );

    if (primaryError) {
      await supabase
        .from("product_media")
        .update({
          is_primary: false,
          is_active: true,
        })
        .eq("id", inserted.id)
        .eq("product_id", productId);

      return {
        ...EMPTY_STATE,
        message:
          "The image was uploaded, but the primary-media update failed. The image remains safely stored as a secondary item.",
        mediaId: inserted.id,
      };
    }

    inserted.is_primary = true;
  }

  const signedUrl = await signMediaPath(
    supabase,
    inserted.media_url,
  );

  if (!signedUrl) {
    return {
      ...EMPTY_STATE,
      message:
        "The image was stored, but a preview URL could not be generated.",
      mediaId: inserted.id,
    };
  }

  return {
    ok: true,
    message: "Image uploaded successfully.",
    mediaId: inserted.id,
    media: {
      id: inserted.id,
      url: signedUrl,
      storagePath: inserted.media_url,
      alt: inserted.alt_text ?? "",
      title: inserted.title ?? "",
      caption: inserted.caption ?? "",
      kind: "image",
      sortOrder: inserted.sort_order,
      isPrimary: inserted.is_primary,
      active: inserted.is_active,
      mimeType,
    },
  };
}

export async function updateProductMediaMetadataAction(
  productId: string,
  mediaId: string,
  altText: string,
  title: string,
  caption: string,
): Promise<ProductMediaActionState> {
  await requireStaff();

  if (!isUuid(productId) || !isUuid(mediaId)) {
    return { ...EMPTY_STATE, message: "The media reference is invalid." };
  }

  const normalizedAlt = altText.trim();
  const normalizedTitle = title.trim();
  const normalizedCaption = caption.trim();
  const metadataError = validateMetadata(
    normalizedAlt,
    normalizedTitle,
    normalizedCaption,
  );

  if (metadataError) {
    return { ...EMPTY_STATE, message: metadataError };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_media")
    .update({
      alt_text: normalizedAlt || null,
      title: normalizedTitle || null,
      caption: normalizedCaption || null,
    })
    .eq("id", mediaId)
    .eq("product_id", productId)
    .select(
      "id,media_url,media_type,alt_text,title,caption,sort_order,is_primary,is_active",
    )
    .maybeSingle();

  if (error) {
    return { ...EMPTY_STATE, message: mapDatabaseError(error) };
  }

  if (!data) {
    return { ...EMPTY_STATE, message: "The media item could not be found." };
  }

  return {
    ok: true,
    message: "Media metadata saved.",
    mediaId: data.id,
  };
}

export async function setProductMediaPrimaryAction(
  productId: string,
  mediaId: string,
): Promise<ProductMediaActionState> {
  await requireStaff();

  if (!isUuid(productId) || !isUuid(mediaId)) {
    return { ...EMPTY_STATE, message: "The media reference is invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_product_media_primary", {
    p_product_id: productId,
    p_media_id: mediaId,
  });

  if (error) {
    return { ...EMPTY_STATE, message: mapDatabaseError(error) };
  }

  return {
    ok: true,
    message: "Primary image updated.",
    mediaId,
  };
}

export async function setProductMediaActiveAction(
  productId: string,
  mediaId: string,
  isActive: boolean,
): Promise<ProductMediaActionState> {
  await requireStaff();

  if (!isUuid(productId) || !isUuid(mediaId)) {
    return { ...EMPTY_STATE, message: "The media reference is invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_product_media_active", {
    p_product_id: productId,
    p_media_id: mediaId,
    p_is_active: isActive,
  });

  if (error) {
    return { ...EMPTY_STATE, message: mapDatabaseError(error) };
  }

  return {
    ok: true,
    message: isActive
      ? "Media activated."
      : "Media deactivated.",
    mediaId,
  };
}

export async function reorderProductMediaAction(
  productId: string,
  mediaIds: string[],
): Promise<ProductMediaActionState> {
  await requireStaff();

  if (
    !isUuid(productId) ||
    mediaIds.length > MAX_PRODUCT_MEDIA_ITEMS ||
    mediaIds.some((id) => !isUuid(id))
  ) {
    return { ...EMPTY_STATE, message: "The media order is invalid." };
  }

  const uniqueIds = new Set(mediaIds);

  if (uniqueIds.size !== mediaIds.length) {
    return { ...EMPTY_STATE, message: "The media order contains duplicates." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_product_media", {
    p_product_id: productId,
    p_media_ids: mediaIds,
  });

  if (error) {
    return { ...EMPTY_STATE, message: mapDatabaseError(error) };
  }

  return {
    ok: true,
    message: "Media order saved.",
  };
}

export async function deleteProductMediaAction(
  productId: string,
  mediaId: string,
): Promise<ProductMediaActionState> {
  await requireStaff();

  if (!isUuid(productId) || !isUuid(mediaId)) {
    return { ...EMPTY_STATE, message: "The media reference is invalid." };
  }

  const supabase = await createClient();

  const { data: media, error: readError } = await supabase
    .from("product_media")
    .select("id,media_url,is_primary")
    .eq("id", mediaId)
    .eq("product_id", productId)
    .maybeSingle();

  if (readError) {
    return { ...EMPTY_STATE, message: mapDatabaseError(readError) };
  }

  if (!media) {
    return { ...EMPTY_STATE, message: "The media item could not be found." };
  }

  const { error: storageError } = await supabase.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .remove([media.media_url]);

  if (storageError) {
    return {
      ...EMPTY_STATE,
      message: mapStorageError(storageError.message),
    };
  }

  const { error: deleteError } = await supabase
    .from("product_media")
    .delete()
    .eq("id", mediaId)
    .eq("product_id", productId);

  if (!deleteError) {
    if (media.is_primary) {
      const { data: replacement } = await supabase
        .from("product_media")
        .select("id")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (replacement?.id) {
        await supabase.rpc("set_product_media_primary", {
          p_product_id: productId,
          p_media_id: replacement.id,
        });
      }
    }

    return {
      ok: true,
      message: "Media deleted.",
      mediaId,
    };
  }

  const { error: deactivateError } = await supabase.rpc(
    "set_product_media_active",
    {
      p_product_id: productId,
      p_media_id: mediaId,
      p_is_active: false,
    },
  );

  return {
    ...EMPTY_STATE,
    message: deactivateError
      ? "The storage file was removed, but the database record could not be finalized. Administrator cleanup is required."
      : "The storage file was removed, but the database record could not be deleted. It was safely deactivated instead.",
    mediaId,
    recordDeactivated: !deactivateError,
  };
}
