"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  DIGITAL_ASSET_MIME_TYPES,
  MAX_DIGITAL_ASSET_BYTES,
} from "@/lib/digital-delivery/assets";
import {
  prepareDigitalAssetUploadAction,
  registerDigitalAssetAction,
} from "@/app/admin/digital-delivery/actions";

interface ProductOption {
  id: string;
  name: string;
  deliveryType: string | null;
  plans: Array<{
    id: string;
    name: string;
    deliveryType: string | null;
  }>;
}

export function DigitalAssetUploader({
  products,
}: {
  products: ProductOption[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerInstructions, setCustomerInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [productId, products],
  );

  const selectedPlan = useMemo(
    () => selectedProduct?.plans.find((plan) => plan.id === planId) ?? null,
    [planId, selectedProduct],
  );

  const validFileType = file
    ? DIGITAL_ASSET_MIME_TYPES.includes(
        file.type as (typeof DIGITAL_ASSET_MIME_TYPES)[number],
      )
    : false;

  async function submit() {
    setMessage("");

    if (!productId) {
      setMessage("Select a product first.");
      return;
    }
    if (!title.trim()) {
      setMessage("Enter a customer-facing file title.");
      return;
    }
    if (!file) {
      setMessage("Select a digital file first.");
      return;
    }
    if (
      !validFileType ||
      file.size <= 0 ||
      file.size > MAX_DIGITAL_ASSET_BYTES
    ) {
      setMessage(
        "Select an approved PDF, ZIP, document, spreadsheet, presentation, text, or image file up to 50 MB.",
      );
      return;
    }

    setBusy(true);

    try {
      const prepare = await prepareDigitalAssetUploadAction(
        productId,
        planId || null,
        file.type,
        file.size,
      );

      if (!prepare.ok || !prepare.uploadToken || !prepare.storagePath) {
        setMessage(prepare.message);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("digital-products")
        .uploadToSignedUrl(
          prepare.storagePath,
          prepare.uploadToken,
          file,
        );

      if (uploadError) {
        setMessage("The digital file could not be uploaded. Please try again.");
        return;
      }

      const registered = await registerDigitalAssetAction(
        productId,
        planId || null,
        prepare.storagePath,
        file.type,
        file.size,
        title,
        description,
        customerInstructions,
      );

      if (!registered.ok) {
        setMessage(registered.message);
        return;
      }

      setTitle("");
      setDescription("");
      setCustomerInstructions("");
      setFile(null);
      setMessage("Digital file uploaded and registered successfully.");
    } catch {
      setMessage(
        "The digital file operation could not be completed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label
            htmlFor="digital-asset-product"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Product
          </label>
          <select
            id="digital-asset-product"
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setPlanId("");
            }}
            disabled={busy || products.length === 0}
            className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          {selectedProduct?.deliveryType ? (
            <p className="mt-2 text-xs text-text-muted">
              Product delivery type: {selectedProduct.deliveryType}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="digital-asset-plan"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Plan scope
          </label>
          <select
            id="digital-asset-plan"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            disabled={busy || !selectedProduct}
            className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
          >
            <option value="">All plans for this product</option>
            {selectedProduct?.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          {selectedPlan?.deliveryType ? (
            <p className="mt-2 text-xs text-text-muted">
              Plan delivery type: {selectedPlan.deliveryType}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label
            htmlFor="digital-asset-title"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Customer-facing title
          </label>
          <input
            id="digital-asset-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            disabled={busy}
            placeholder="e.g. Setup guide"
            className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
          />
        </div>

        <div>
          <label
            htmlFor="digital-asset-description"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Description
          </label>
          <input
            id="digital-asset-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            disabled={busy}
            placeholder="Optional customer-safe description"
            className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="digital-asset-instructions"
          className="mb-2 block text-sm font-medium text-text-secondary"
        >
          Customer instructions
        </label>
        <textarea
          id="digital-asset-instructions"
          value={customerInstructions}
          onChange={(event) => setCustomerInstructions(event.target.value)}
          maxLength={5000}
          rows={4}
          disabled={busy}
          placeholder="Optional safe instructions shown with the file."
          className="min-h-28 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
        />
      </div>

      <div>
        <label
          htmlFor="digital-asset-file"
          className="mb-2 block text-sm font-medium text-text-secondary"
        >
          Digital file
        </label>
        <input
          id="digital-asset-file"
          type="file"
          accept={DIGITAL_ASSET_MIME_TYPES.join(",")}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={busy || products.length === 0}
          className="block min-h-11 w-full cursor-pointer rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3 py-2 text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-2 file:text-xs file:font-semibold file:text-text-inverse"
        />
        <p className="mt-2 text-xs leading-5 text-text-muted">
          PDF, ZIP, common Office documents, text/CSV, or JPG/PNG/WebP · maximum 50 MB. HTML/JS/executable files are not accepted.
        </p>
        {file ? (
          <p className="mt-2 text-xs text-text-secondary">
            Selected: {file.name} ·{" "}
            {file.size < 1024 * 1024
              ? Math.max(1, Math.ceil(file.size / 1024)) + " KB"
              : (file.size / (1024 * 1024)).toFixed(1) + " MB"}
          </p>
        ) : null}
      </div>

      {message ? (
        <div
          className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 py-3 text-sm text-text-secondary"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={busy || products.length === 0}
        >
          {busy ? "Uploading…" : "Upload private file"}
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-amber-100">
          No configured digital products are available for asset upload.
        </p>
      ) : null}
    </div>
  );
}