"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { sendTransactionalEmail } from "@/lib/email/server";

function messageFromError(errorMessage: string): string {
  const messages: Record<string, string> = {
    "digital:not_authorized": "You are not authorized to manage digital fulfillment.",
    "digital:order_item_not_found": "The order item could not be found.",
    "digital:order_not_found": "The related order could not be found.",
    "digital:customer_missing": "The order does not have a customer account.",
    "digital:payment_not_paid": "The payment has not been verified as paid.",
    "digital:order_ineligible": "The order is no longer eligible for digital fulfillment.",
    "digital:product_missing": "The purchased product could not be found.",
    "digital:not_a_digital_product": "This order item is not a digital product.",
    "digital:delivery_not_configured": "Digital delivery is not configured for this product or plan.",
    "digital:access_url_invalid": "The customer access URL must be an HTTPS URL no longer than 2048 characters.",
    "digital:status_invalid": "The entitlement status is invalid.",
    "digital:entitlement_not_found": "The digital entitlement could not be found.",
    "digital:access_not_eligible": "This entitlement cannot be activated because payment/order eligibility has changed or it has expired.",
  };
  return messages[errorMessage] ?? "The digital fulfillment request could not be completed.";
}

export async function fulfillDigitalOrderItemAction(formData: FormData) {
  await requireStaff();

  const orderItemId = formData.get("orderItemId");
  const accessUrlValue = formData.get("customerAccessUrl");

  if (typeof orderItemId !== "string" || !isUuid(orderItemId)) {
    redirect("/admin/digital-delivery?error=" + encodeURIComponent("The order item reference is invalid."));
  }

  const customerAccessUrl =
    typeof accessUrlValue === "string" && accessUrlValue.trim()
      ? accessUrlValue.trim()
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fulfill_digital_order_item", {
    p_order_item_id: orderItemId,
    p_customer_access_url: customerAccessUrl,
  });

  if (error) {
    redirect("/admin/digital-delivery?error=" + encodeURIComponent(messageFromError(error.message)));
  }

  const result = data as Record<string, unknown> | null;
  const entitlementId = typeof result?.entitlementId === "string" ? result.entitlementId : null;
  if (entitlementId && isUuid(entitlementId)) {
    after(() => {
      void sendTransactionalEmail({ event: "digital_entitlement_ready", entitlementId }).catch(() => undefined);
    });
  }

  revalidatePath("/admin/digital-delivery");
  revalidatePath("/account");
  revalidatePath("/account/orders");
  revalidatePath("/account/digital-products");

  redirect("/admin/digital-delivery?success=" + encodeURIComponent("Digital entitlement fulfillment completed."));
}

export async function setDigitalEntitlementStatusAction(formData: FormData) {
  await requireStaff();

  const entitlementId = formData.get("entitlementId");
  const status = formData.get("accessStatus");

  if (
    typeof entitlementId !== "string" ||
    !isUuid(entitlementId) ||
    typeof status !== "string"
  ) {
    redirect("/admin/digital-delivery?error=" + encodeURIComponent("The entitlement reference is invalid."));
  }

  if (!["active", "suspended", "expired", "revoked"].includes(status)) {
    redirect("/admin/digital-delivery?error=" + encodeURIComponent("The entitlement status is invalid."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_digital_entitlement_status", {
    p_entitlement_id: entitlementId,
    p_access_status: status,
  });

  if (error) {
    redirect("/admin/digital-delivery?error=" + encodeURIComponent(messageFromError(error.message)));
  }

  revalidatePath("/admin/digital-delivery");
  revalidatePath("/account");
  revalidatePath("/account/digital-products");

  redirect("/admin/digital-delivery?success=" + encodeURIComponent("Entitlement status updated."));
}
