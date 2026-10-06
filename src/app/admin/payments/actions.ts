"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { sendTransactionalEmail } from "@/lib/email/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getPaymentId(formData: FormData): string | null {
  const value = formData.get("paymentId");

  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value
    : null;
}

function redirectWithMessage(
  type: "success" | "error",
  message: string,
): never {
  redirect(
    `/admin/payments?${type}=${encodeURIComponent(message)}`,
  );
}

export async function markManualPaymentPaidAction(formData: FormData) {
  await requireStaff();

  const paymentId = getPaymentId(formData);

  if (!paymentId) {
    redirectWithMessage("error", "The payment reference is invalid.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_manual_bank_payment", {
    p_payment_id: paymentId,
  });

  if (error) {
    const known = new Map([
      ["payment:not_authorized", "You are not authorized to verify payments."],
      ["payment:not_found", "The payment could not be found."],
      ["payment:not_verifiable", "This payment is no longer pending verification."],
      ["payment:order_ineligible", "The related order is no longer eligible for verification."],
      ["payment:proof_missing", "A payment proof must be attached before the payment can be marked as paid."],
    ]);

    redirectWithMessage(
      "error",
      known.get(error.message) ??
        "The payment could not be verified. Please try again.",
    );
  }

  after(() => {
    void sendTransactionalEmail({ event: "payment_paid", paymentId }).catch(() => undefined);
  });

  revalidatePath("/admin/payments");
  redirectWithMessage("success", "Payment marked as paid.");
}

export async function rejectManualPaymentAction(formData: FormData) {
  await requireStaff();

  const paymentId = getPaymentId(formData);

  if (!paymentId) {
    redirectWithMessage("error", "The payment reference is invalid.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_manual_bank_payment", {
    p_payment_id: paymentId,
  });

  if (error) {
    const known = new Map([
      ["payment:not_authorized", "You are not authorized to reject payments."],
      ["payment:not_found", "The payment could not be found."],
      ["payment:not_rejectable", "This payment is no longer pending verification."],
      ["payment:proof_missing", "A payment proof must be attached before the payment can be marked as paid."],
    ]);

    redirectWithMessage(
      "error",
      known.get(error.message) ??
        "The payment could not be rejected. Please try again.",
    );
  }

  after(() => {
    void sendTransactionalEmail({ event: "payment_rejected", paymentId }).catch(() => undefined);
  });

  revalidatePath("/admin/payments");
  redirectWithMessage("success", "Payment rejected.");
}

export async function saveManualBankTransferSettingsAction(
  formData: FormData,
) {
  const context = await requireStaff();
  const supabase = await createClient();

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "current_user_is_admin",
  );

  if (adminError || !isAdmin) {
    redirectWithMessage(
      "error",
      "Only authorized administrators can change payment settings.",
    );
  }

  const enabled = formData.get("enabled") === "on";
  const bankName = String(formData.get("bankName") ?? "").trim();
  const accountName = String(formData.get("accountName") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();
  const branch = String(formData.get("branch") ?? "").trim();
  const bankCodeSwift = String(formData.get("bankCodeSwift") ?? "").trim();
  const paymentInstructions = String(
    formData.get("paymentInstructions") ?? "",
  ).trim();

  if (bankName.length > 120 || accountName.length > 120 || accountNumber.length > 120) {
    redirectWithMessage("error", "Bank details are longer than the supported limit.");
  }

  if (branch.length > 120 || bankCodeSwift.length > 120) {
    redirectWithMessage("error", "Branch or bank code is longer than the supported limit.");
  }

  if (paymentInstructions.length > 5000) {
    redirectWithMessage("error", "Payment instructions are too long.");
  }

  const { error } = await supabase
    .from("payment_settings")
    .upsert(
      {
        payment_method: "manual_bank_transfer",
        enabled,
        bank_name: bankName || null,
        account_name: accountName || null,
        account_number: accountNumber || null,
        branch: branch || null,
        bank_code_swift: bankCodeSwift || null,
        payment_instructions: paymentInstructions || null,
        updated_by: context.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "payment_method" },
    );

  if (error) {
    redirectWithMessage(
      "error",
      "Payment settings could not be saved. Please try again.",
    );
  }

  revalidatePath("/admin/payments");
  revalidatePath("/checkout");
  revalidatePath("/payment");
  redirectWithMessage("success", "Manual bank transfer settings saved.");
}
