"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Button, Surface } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  isSupportedProductImageMimeType,
  MAX_PRODUCT_MEDIA_FILE_SIZE,
  PRODUCT_IMAGE_MIME_TYPES,
  PRODUCT_MEDIA_BUCKET,
} from "@/lib/catalog/media";
import type { AdminProductMedia } from "@/lib/catalog/types";
import {
  deleteProductMediaAction,
  prepareProductMediaUploadAction,
  registerProductMediaAction,
  reorderProductMediaAction,
  setProductMediaActiveAction,
  setProductMediaPrimaryAction,
  updateProductMediaMetadataAction,
} from "@/app/admin/products/media-actions";

interface ProductMediaManagerProps {
  productId?: string;
  productName: string;
  initialMedia: AdminProductMedia[];
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function getDefaultAlt(fileName: string, productName: string): string {
  const base = fileName.replace(/.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? productName + " - " + base : productName;
}

export function ProductMediaManager({
  productId,
  productName,
  initialMedia,
}: ProductMediaManagerProps) {
  const [media, setMedia] = useState(initialMedia);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadFiles(files: FileList | null) {
    if (!productId || !files?.length) {
      return;
    }

    setBusy(true);
    setError("");
    setStatus("");

    const supabase = createClient();
    const fileArray = Array.from(files);
    let hadError = false;

    for (let index = 0; index < fileArray.length; index += 1) {
      const file = fileArray[index];
      setStatus(
        "Uploading " +
          (index + 1) +
          " of " +
          fileArray.length +
          ": " +
          file.name,
      );

      if (
        !isSupportedProductImageMimeType(file.type) ||
        !PRODUCT_IMAGE_MIME_TYPES.includes(
          file.type as (typeof PRODUCT_IMAGE_MIME_TYPES)[number],
        )
      ) {
        hadError = true;
        setError(
          file.name +
            " was rejected. Only JPEG, PNG and WebP images are supported.",
        );
        continue;
      }

      if (file.size <= 0 || file.size > MAX_PRODUCT_MEDIA_FILE_SIZE) {
        hadError = true;
        setError(
          file.name +
            " was rejected. Maximum image size is " +
            formatFileSize(MAX_PRODUCT_MEDIA_FILE_SIZE) +
            ".",
        );
        continue;
      }

      try {
        const prepared = await prepareProductMediaUploadAction(
          productId,
          file.type,
          file.size,
        );

        if (!prepared.ok || !prepared.storagePath || !prepared.uploadToken) {
          hadError = true;
          setError(prepared.message || "The upload could not be prepared.");
          continue;
        }

        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_MEDIA_BUCKET)
          .uploadToSignedUrl(
            prepared.storagePath,
            prepared.uploadToken,
            file,
          );

        if (uploadError) {
          hadError = true;
          setError(
            file.name +
              ": " +
              (uploadError.message || "The image upload failed."),
          );
          continue;
        }

        const registered = await registerProductMediaAction(
          productId,
          prepared.storagePath,
          file.type,
          getDefaultAlt(file.name, productName),
          "",
          "",
        );

        if (!registered.ok || !registered.media) {
          hadError = true;
          setError(
            registered.message ||
              "The file uploaded but could not be registered in the catalog.",
          );
          continue;
        }

        setMedia((current) => [...current, registered.media as AdminProductMedia]);
      } catch {
        hadError = true;
        setError(file.name + ": The upload could not be completed.");
      }
    }

    setBusy(false);
    setStatus(
      hadError
        ? "Upload finished with one or more errors."
        : "Media upload finished.",
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function saveMetadata(item: AdminProductMedia) {
    if (!productId) return;

    setBusy(true);
    setError("");
    setStatus("Saving metadata…");

    const result = await updateProductMediaMetadataAction(
      productId,
      item.id,
      item.alt ?? "",
      item.title ?? "",
      item.caption ?? "",
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setStatus("Metadata saved.");
  }

  async function makePrimary(itemId: string) {
    if (!productId) return;

    setBusy(true);
    setError("");
    setStatus("Updating primary image…");

    const result = await setProductMediaPrimaryAction(productId, itemId);

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMedia((current) =>
      current.map((item) => ({
        ...item,
        isPrimary: item.id === itemId,
      })),
    );
    setStatus("Primary image updated.");
  }

  async function toggleActive(item: AdminProductMedia) {
    if (!productId) return;

    setBusy(true);
    setError("");
    setStatus(item.active ? "Deactivating media…" : "Activating media…");

    const result = await setProductMediaActiveAction(
      productId,
      item.id,
      !item.active,
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMedia((current) =>
      current.map((currentItem) => ({
        ...currentItem,
        active:
          currentItem.id === item.id
            ? !item.active
            : currentItem.active,
        isPrimary:
          result.primaryMediaId
            ? currentItem.id === result.primaryMediaId
            : currentItem.isPrimary,
      })),
    );

    setStatus(result.message);
  }

  async function moveItem(index: number, direction: -1 | 1) {
    if (!productId) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= media.length) return;

    const ordered = [...media];
    [ordered[index], ordered[nextIndex]] = [
      ordered[nextIndex],
      ordered[index],
    ];

    setBusy(true);
    setError("");
    setStatus("Saving media order…");

    const result = await reorderProductMediaAction(
      productId,
      ordered.map((item) => item.id),
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMedia(
      ordered.map((item, itemIndex) => ({
        ...item,
        sortOrder: itemIndex,
      })),
    );
    setStatus("Media order saved.");
  }

  async function deleteItem(item: AdminProductMedia) {
    if (!productId) return;

    setBusy(true);
    setError("");
    setStatus("Deleting media…");

    const result = await deleteProductMediaAction(productId, item.id);

    setBusy(false);
    setDeleteConfirmId(null);

    if (!result.ok) {
      if (result.recordDeactivated) {
        setMedia((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, active: false, isPrimary: false }
              : currentItem,
          ),
        );
      }
      setError(result.message);
      return;
    }

    setMedia((current) =>
      current
        .filter((currentItem) => currentItem.id !== item.id)
        .map((currentItem, index) => ({
          ...currentItem,
          sortOrder: index,
          isPrimary:
            result.replacementMediaId
              ? currentItem.id === result.replacementMediaId
              : currentItem.isPrimary,
        })),
    );
    setStatus(
      item.isPrimary
        ? "Media deleted. The next active image was selected as primary when available."
        : "Media deleted.",
    );
  }

  function updateLocalMetadata(
    itemId: string,
    key: "alt" | "title" | "caption",
    value: string,
  ) {
    setMedia((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, [key]: value } : item,
      ),
    );
  }

  if (!productId) {
    return (
      <div className="rounded-[var(--probee-radius-md)] border border-dashed border-[var(--probee-border-default)] bg-surface-2 p-5">
        <p className="text-sm font-semibold">Save the product before adding media</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Product images are stored against a real product ID, so media upload
          becomes available after the first successful product save.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Catalog images</p>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              JPEG, PNG or WebP • up to 5 MB each • maximum 30 images per product
            </p>
          </div>

          <label className="probee-focus-ring inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-5 text-sm font-semibold text-text-inverse hover:bg-gold-hover">
            {busy ? "Working…" : "Select images"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              className="sr-only"
              onChange={(event) => {
                void uploadFiles(event.target.files);
              }}
            />
          </label>
        </div>
      </div>

      {status ? (
        <p className="mt-4 text-sm text-text-secondary" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {media.length === 0 ? (
        <div className="mt-5 rounded-[var(--probee-radius-md)] border border-dashed border-[var(--probee-border-default)] bg-surface-1 p-6 text-center">
          <p className="text-sm font-semibold">No product images yet</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Upload the storefront images that should represent this product.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {media.map((item, index) => (
            <Surface key={item.id} className="overflow-hidden p-4 sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2">
                    {item.url ? (
                      <Image
                        src={item.url}
                        alt={item.alt || productName}
                        fill
                        sizes="(min-width: 1024px) 224px, 100vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-text-muted">
                        Preview unavailable
                      </div>
                    )}

                    {item.isPrimary ? (
                      <span className="absolute left-2 top-2 rounded-full border border-[var(--probee-border-default)] bg-background/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-gold">
                        Primary
                      </span>
                    ) : null}

                    {!item.active ? (
                      <span className="absolute right-2 top-2 rounded-full border border-red-400/30 bg-background/90 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-red-200">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="text-sm font-semibold">Image {index + 1}</p>
                      <p className="mt-1 truncate text-xs text-text-muted">
                        {item.storagePath}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        onClick={() => void moveItem(index, -1)}
                        aria-label={"Move image " + (index + 1) + " up"}
                        className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold disabled:opacity-40"
                      >
                        ↑ Move up
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === media.length - 1}
                        onClick={() => void moveItem(index, 1)}
                        aria-label={"Move image " + (index + 1) + " down"}
                        className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold disabled:opacity-40"
                      >
                        ↓ Move down
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <label
                        htmlFor={"media-alt-" + item.id}
                        className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary"
                      >
                        Alt text
                      </label>
                      <input
                        id={"media-alt-" + item.id}
                        value={item.alt ?? ""}
                        maxLength={180}
                        onChange={(event) =>
                          updateLocalMetadata(item.id, "alt", event.target.value)
                        }
                        className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={"media-title-" + item.id}
                        className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary"
                      >
                        Title
                      </label>
                      <input
                        id={"media-title-" + item.id}
                        value={item.title ?? ""}
                        maxLength={180}
                        onChange={(event) =>
                          updateLocalMetadata(item.id, "title", event.target.value)
                        }
                        className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={"media-caption-" + item.id}
                        className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary"
                      >
                        Caption
                      </label>
                      <textarea
                        id={"media-caption-" + item.id}
                        value={item.caption ?? ""}
                        maxLength={500}
                        rows={3}
                        onChange={(event) =>
                          updateLocalMetadata(
                            item.id,
                            "caption",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void saveMetadata(item)}
                      >
                        Save metadata
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant={item.isPrimary ? "secondary" : "primary"}
                        disabled={busy || !item.active || item.isPrimary}
                        onClick={() => void makePrimary(item.id)}
                      >
                        {item.isPrimary ? "Primary image" : "Make primary"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void toggleActive(item)}
                      >
                        {item.active ? "Deactivate" : "Activate"}
                      </Button>

                      {deleteConfirmId === item.id ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-2">
                          <span className="text-xs text-red-100">
                            Delete this stored image permanently?
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteItem(item)}
                            className="probee-focus-ring min-h-9 rounded-lg bg-red-500/20 px-3 text-xs font-semibold text-red-100"
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeleteConfirmId(null)}
                            className="probee-focus-ring min-h-9 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="text-red-200 hover:text-red-100"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
