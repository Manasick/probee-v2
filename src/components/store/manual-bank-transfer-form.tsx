"use client";

import { useState } from "react";
import { Button, Input, Surface } from "@/components/ui";
import {
  PAYMENT_PROOF_MAX_BYTES,
  PAYMENT_PROOF_MIME_TYPES,
  PAYMENT_REFERENCE_MAX_LENGTH,
} from "@/lib/payments/validation";

interface ManualBankTransferSettings {
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branch: string | null;
  bankCodeSwift: string | null;
  paymentInstructions: string | null;
}

interface ExistingPayment {
  paymentStatus: string;
  externalReference: string | null;
  amount: number | string;
  currency: string;
  proofFilename: string | null;
  proofSize: number | null;
  proofStatus: string | null;
}

interface ManualBankTransferFormProps {
  orderReference: string;
  amount: number | string;
  currency: string;
  settings: ManualBankTransferSettings | null;
  existingPayment: ExistingPayment | null;
}

function formatAmount(amount: number | string, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function CopyField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return null;
  }

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
            {label}
          </p>
          <p className="mt-1 break-words text-sm font-medium text-text-primary">
            {value}
          </p>
        </div>
        <button
          type="button"
          onClick={copyValue}
          className="probee-focus-ring shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gold hover:bg-surface-3"
          aria-label={`Copy ${label}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function ManualBankTransferForm({
  orderReference,
  amount,
  currency,
  settings,
  existingPayment,
}: ManualBankTransferFormProps) {
  const [paymentReference, setPaymentReference] = useState(
    existingPayment?.externalReference ?? "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(
    existingPayment?.paymentStatus === "pending" &&
      Boolean(existingPayment?.proofStatus),
  );

  const bankTransferEnabled = Boolean(settings);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!bankTransferEnabled) {
      setMessage("Manual bank transfer is currently unavailable.");
      return;
    }

    if (
      paymentReference.trim().length < 2 ||
      paymentReference.trim().length > PAYMENT_REFERENCE_MAX_LENGTH
    ) {
      setMessage("Enter a valid payment reference or transaction ID.");
      return;
    }

    if (!file) {
      setMessage("Select your payment proof before submitting.");
      return;
    }

    if (
      file.size <= 0 ||
      file.size > PAYMENT_PROOF_MAX_BYTES ||
      !PAYMENT_PROOF_MIME_TYPES.includes(
        file.type as (typeof PAYMENT_PROOF_MIME_TYPES)[number],
      )
    ) {
      setMessage("Upload a valid JPG, PNG, WebP, or PDF payment proof up to 10 MB.");
      return;
    }

    setSubmitting(true);

    try {
      const form = new FormData();
      form.set("orderReference", orderReference);
      form.set("paymentReference", paymentReference.trim());
      form.set("proof", file);

      const response = await fetch(
        "/api/payments/manual-bank-transfer",
        {
          method: "POST",
          body: form,
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        paymentStatus?: string;
        verificationStatus?: string;
        amount?: number | string;
        currency?: string;
      };

      if (!response.ok) {
        setMessage(payload.error ?? "The payment submission could not be completed.");
        return;
      }

      setSubmitted(true);
      setFile(null);
      setMessage(
        "Payment proof submitted successfully. Your payment is now pending verification.",
      );
    } catch {
      setMessage(
        "We could not confirm the upload. Your payment was not marked as paid.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Surface className="p-6 sm:p-8">
        <p className="probee-label">Manual bank transfer</p>
        <h2 className="mt-2 text-2xl font-semibold">Complete the payment</h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Transfer the exact order amount below, then submit your transaction reference and proof.
        </p>

        <div className="mt-6 rounded-[var(--probee-radius-lg)] border border-[var(--probee-border-default)] bg-surface-2 p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
            Amount to transfer
          </p>
          <p className="mt-2 text-2xl font-semibold text-gold">
            {formatAmount(amount, currency)}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Order reference: {orderReference}
          </p>
        </div>

        {!bankTransferEnabled ? (
          <div
            className="mt-5 rounded-[var(--probee-radius-md)] border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100"
            role="alert"
          >
            Manual bank transfer is currently unavailable. You cannot submit a bank-transfer payment until the method is enabled.
          </div>
        ) : null}

        {existingPayment?.paymentStatus === "paid" ? (
          <div
            className="mt-5 rounded-[var(--probee-radius-md)] border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm leading-6 text-emerald-100"
            role="status"
          >
            This payment has already been verified by ProBee.
          </div>
        ) : null}

        {existingPayment?.paymentStatus === "rejected" ? (
          <div
            className="mt-5 rounded-[var(--probee-radius-md)] border border-red-300/20 bg-red-300/5 p-4 text-sm leading-6 text-red-100"
            role="alert"
          >
            The previous payment submission was rejected. You can submit a new proof below.
          </div>
        ) : null}

        {submitted ? (
          <div
            className="mt-5 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 p-4"
            role="status"
          >
            <p className="text-sm font-semibold text-text-primary">
              Payment submitted
            </p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Reference: {paymentReference.trim()}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Status: Pending verification
            </p>
            {existingPayment?.proofFilename ? (
              <p className="mt-1 text-xs text-text-muted">
                Existing proof: {existingPayment.proofFilename}
              </p>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <div
            className="mt-5 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 p-4 text-sm text-text-secondary"
            role="alert"
            aria-live="polite"
          >
            {message}
          </div>
        ) : null}

        {!submitted && existingPayment?.paymentStatus !== "paid" ? (
          <form onSubmit={submit} className="mt-6 grid gap-5">
            <Input
              label="Payment reference / transaction ID"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              maxLength={PAYMENT_REFERENCE_MAX_LENGTH}
              required
              autoComplete="off"
              hint="Enter the reference shown by your bank after the transfer."
            />

            <div>
              <label
                htmlFor="payment-proof"
                className="mb-2 block text-sm font-medium text-text-secondary"
              >
                Payment proof
              </label>
              <input
                id="payment-proof"
                name="proof"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                className="block min-h-11 w-full cursor-pointer rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3 py-2 text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-2 file:text-xs file:font-semibold file:text-text-inverse"
                disabled={!bankTransferEnabled || submitting}
              />
              <p className="mt-2 text-xs leading-5 text-text-muted">
                JPG, PNG, WebP, or PDF · maximum 10 MB.
              </p>
              {file ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-text-secondary">
                    Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
                  </p>
                  <button
                    type="button"
                    className="probee-focus-ring rounded-md px-2 py-1 text-xs font-semibold text-text-muted hover:text-text-primary"
                    onClick={() => setFile(null)}
                    disabled={submitting}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>

            <Button
              size="lg"
              type="submit"
              className="w-full"
              disabled={!bankTransferEnabled || submitting}
            >
              {submitting ? "Uploading proof…" : "Submit payment proof"}
            </Button>
          </form>
        ) : null}
      </Surface>

      <Surface className="p-6 sm:p-8">
        <p className="probee-label">Bank details</p>
        <h2 className="mt-2 text-xl font-semibold">Transfer instructions</h2>

        {bankTransferEnabled ? (
          <div className="mt-5 grid gap-3">
            <CopyField label="Bank Name" value={settings?.bankName ?? null} />
            <CopyField label="Account Name" value={settings?.accountName ?? null} />
            <CopyField label="Account Number" value={settings?.accountNumber ?? null} />
            <CopyField label="Branch" value={settings?.branch ?? null} />
            <CopyField label="Bank Code / SWIFT" value={settings?.bankCodeSwift ?? null} />

            {settings?.paymentInstructions ? (
              <div className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
                  Payment instructions
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
                  {settings.paymentInstructions}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-text-muted">
            Bank-transfer details are currently unavailable.
          </p>
        )}
      </Surface>
    </div>
  );
}
