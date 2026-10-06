"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { isUuid } from "@/lib/admin/validation";

export async function setOrderStatusAction(formData: FormData) {
  await requireStaff();

  const rawId = formData.get("orderId");
  const rawStatus = formData.get("orderStatus");
  const orderId = typeof rawId === "string" ? rawId : "";
  const orderStatus = typeof rawStatus === "string" ? rawStatus : "";

  if (!isUuid(orderId)) {
    redirect("/admin/orders?error=" + encodeURIComponent("The order reference is invalid."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_admin_order_status", {
    p_order_id: orderId,
    p_order_status: orderStatus,
  });

  if (error) {
    const messages: Record<string, string> = {
      "admin:not_authorized": "You are not authorized to change order status.",
      "admin:order_not_found": "The order could not be found.",
      "admin:order_status_invalid": "The order status is invalid.",
      "admin:order_transition_invalid": "That order status transition is not allowed.",
      "admin:refund_payment_required": "A refunded payment state must be recorded by the payment workflow before an order can be marked refunded.",
    };
    redirect("/admin/orders/" + orderId + "?error=" + encodeURIComponent(messages[error.message] ?? "The order status could not be changed."));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/" + orderId);
  redirect("/admin/orders/" + orderId + "?success=" + encodeURIComponent("Order status updated."));
}
