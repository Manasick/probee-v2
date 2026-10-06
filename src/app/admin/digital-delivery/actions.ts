"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import {
  DIGITAL_DELIVERY_BUCKET,
  DIGITAL_ASSET_MIME_TYPES,
  hasSupportedSignature,
  isSafeDigitalAssetPath,
  isSupportedDigitalAssetMimeType,
  MAX_DIGITAL_ASSET_BYTES,
  mimeMatchesPath,
} from "@/lib/digital-delivery/assets";
import { isUuid } from "@/lib/admin/validation";

interface AssetActionState {
  ok: boolean;
  message: string;
  storagePath?: string;
  uploadToken?: string;
}

const EMPTY_STATE: AssetActionState = { ok: false, message: "" };

function mapStorageError(message?: string | null): string {
  if (message?.toLowerCase().includes("not found")) return "The digital file could not be found.";
  if (message?.toLowerCase().includes("already exists")) return "A digital file already exists at that storage path. Please retry.";
  return "The digital file storage operation could not be completed.";
}

function mapDatabaseError(error: { code?: string | null; message?: string | null }): string {
  if (error.code === "23505") return "This digital file is already registered.";
  if (error.code === "23514") return "The digital asset metadata does not satisfy the validation rules.";
  if (error.code === "23503") return "The selected product or plan could not be found.";
  if (error.code === "42501") return "You are not authorized to manage digital assets.";
  return "The digital asset operation could not be completed.";
}

async function isEligibleProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  planId: string | null,
): Promise<boolean> {
  const { data: product } = await supabase
    .from("products")
    .select("id,product_type,delivery_type")
    .eq("id", productId)
    .maybeSingle();

  if (!product || !["digital", "license", "subscription"].includes(product.product_type)) {
    return false;
  }

  if (!planId) return Boolean(product.delivery_type?.trim());

  const { data: plan } = await supabase
    .from("product_plans")
    .select("id,product_id,delivery_type")
    .eq("id", planId)
    .eq("product_id", productId)
    .maybeSingle();

  return Boolean(plan && (plan.delivery_type?.trim() || product.delivery_type?.trim()));
}

function getExtension(mimeType: (typeof DIGITAL_ASSET_MIME_TYPES)[number]): string {
  return ({
    "application/pdf": "pdf",
    "application/zip": "zip",
    "text/plain": "txt",
    "text/csv": "csv",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  } as const)[mimeType];
}

export async function prepareDigitalAssetUploadAction(
  productId: string,
  planId: string | null,
  mimeType: string,
  size: number,
): Promise<AssetActionState> {
  await requireStaff();

  if (!isUuid(productId) || (planId !== null && !isUuid(planId))) {
    return { ...EMPTY_STATE, message: "The product or plan reference is invalid." };
  }

  if (!isSupportedDigitalAssetMimeType(mimeType) || !Number.isFinite(size) || size <= 0 || size > MAX_DIGITAL_ASSET_BYTES) {
    return {
      ...EMPTY_STATE,
      message: "Only approved digital files up to 50 MB are allowed. Executable web/script files are not accepted.",
    };
  }

  const supabase = await createClient();

  if (!(await isEligibleProduct(supabase, productId, planId))) {
    return {
      ...EMPTY_STATE,
      message: "This product is not configured for digital delivery. Set a digital delivery type first.",
    };
  }

  const typedMime = mimeType as (typeof DIGITAL_ASSET_MIME_TYPES)[number];
  const storagePath = "digital-products/" + productId + "/" + randomUUID() + "." + getExtension(typedMime);

  const { data, error } = await supabase.storage
    .from(DIGITAL_DELIVERY_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.token) {
    return { ...EMPTY_STATE, message: mapStorageError(error?.message) };
  }

  return {
    ok: true,
    message: "Upload slot prepared.",
    storagePath,
    uploadToken: data.token,
  };
}

export async function registerDigitalAssetAction(
  productId: string,
  planId: string | null,
  storagePath: string,
  mimeType: string,
  size: number,
  title: string,
  description: string,
  customerInstructions: string,
): Promise<AssetActionState> {
  await requireStaff();

  if (
    !isUuid(productId) ||
    (planId !== null && !isUuid(planId)) ||
    !isSupportedDigitalAssetMimeType(mimeType) ||
    !isSafeDigitalAssetPath(productId, storagePath) ||
    !mimeMatchesPath(
      mimeType as (typeof DIGITAL_ASSET_MIME_TYPES)[number],
      storagePath,
    )
  ) {
    return { ...EMPTY_STATE, message: "The uploaded digital asset reference is invalid." };
  }

  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();
  const normalizedInstructions = customerInstructions.trim();

  if (!normalizedTitle || normalizedTitle.length > 180) {
    return { ...EMPTY_STATE, message: "A digital asset title between 1 and 180 characters is required." };
  }
  if (normalizedDescription.length > 1000) {
    return { ...EMPTY_STATE, message: "The digital asset description is too long." };
  }
  if (normalizedInstructions.length > 5000) {
    return { ...EMPTY_STATE, message: "Customer instructions are too long." };
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_DIGITAL_ASSET_BYTES) {
    return { ...EMPTY_STATE, message: "The digital file size is invalid." };
  }

  const supabase = await createClient();

  if (!(await isEligibleProduct(supabase, productId, planId))) {
    await supabase.storage.from(DIGITAL_DELIVERY_BUCKET).remove([storagePath]);
    return {
      ...EMPTY_STATE,
      message: "This product is not configured for digital delivery. The uploaded file was removed.",
    };
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(DIGITAL_DELIVERY_BUCKET)
    .download(storagePath);

  if (downloadError || !blob) {
    await supabase.storage.from(DIGITAL_DELIVERY_BUCKET).remove([storagePath]);
    return { ...EMPTY_STATE, message: "The uploaded file could not be verified and was not registered." };
  }

  if (blob.size <= 0 || blob.size > MAX_DIGITAL_ASSET_BYTES || blob.size !== size) {
    await supabase.storage.from(DIGITAL_DELIVERY_BUCKET).remove([storagePath]);
    return { ...EMPTY_STATE, message: "The uploaded file size could not be verified." };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (!hasSupportedSignature(bytes, mimeType as (typeof DIGITAL_ASSET_MIME_TYPES)[number])) {
    await supabase.storage.from(DIGITAL_DELIVERY_BUCKET).remove([storagePath]);
    return {
      ...EMPTY_STATE,
      message: "The file contents did not match the selected file type and were rejected.",
    };
  }

  const { data: inserted, error } = await supabase
    .from("digital_delivery_assets")
    .insert({
      product_id: productId,
      plan_id: planId,
      title: normalizedTitle,
      description: normalizedDescription || null,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size_bytes: blob.size,
      customer_instructions: normalizedInstructions || null,
      is_active: true,
    })
    .select("id,product_id,plan_id,title,description,mime_type,file_size_bytes,customer_instructions,is_active,created_at")
    .single();

  if (error || !inserted) {
    await supabase.storage.from(DIGITAL_DELIVERY_BUCKET).remove([storagePath]);
    return {
      ...EMPTY_STATE,
      message: error ? mapDatabaseError(error) : "The digital asset record could not be created.",
    };
  }

  revalidatePath("/admin/digital-delivery");
  revalidatePath("/admin/digital-delivery/assets");

  return { ok: true, message: "Digital file uploaded and registered successfully." };
}

export async function setDigitalAssetActiveAction(formData: FormData) {
  await requireStaff();

  const assetId = formData.get("assetId");
  const isActive = formData.get("isActive") === "true";

  if (typeof assetId !== "string" || !isUuid(assetId)) return;

  const supabase = await createClient();
  await supabase
    .from("digital_delivery_assets")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", assetId);

  revalidatePath("/admin/digital-delivery/assets");
  revalidatePath("/admin/digital-delivery");
}