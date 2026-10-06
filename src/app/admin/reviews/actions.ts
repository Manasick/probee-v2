"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERROR_MESSAGES: Record<string, string> = {
  "review:not_authorized": "You are not authorized to moderate reviews.",
  "review:not_found": "That review could not be found.",
  "review:moderation_status_invalid": "That moderation status is invalid.",
  "review:moderation_reason_too_long": "The moderation note is too long.",
  "review:purchase_required":
    "This review cannot be approved because the purchase is no longer eligible.",
};

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect("/admin/reviews?" + type + "=" + encodeURIComponent(message));
}

export async function moderateReviewAction(formData: FormData) {
  await requireStaff();

  const reviewId = formData.get("reviewId");
  const status = formData.get("status");
  const reason =
    typeof formData.get("reason") === "string"
      ? String(formData.get("reason")).trim()
      : "";

  if (
    typeof reviewId !== "string" ||
    !UUID_PATTERN.test(reviewId) ||
    typeof status !== "string"
  ) {
    redirectWithMessage("error", "The review reference is invalid.");
  }

  if (!["pending", "approved", "rejected", "hidden"].includes(status)) {
    redirectWithMessage("error", "That moderation status is invalid.");
  }

  if (reason.length > 500) {
    redirectWithMessage("error", ERROR_MESSAGES["review:moderation_reason_too_long"]);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_moderation", {
    p_review_id: reviewId,
    p_status: status,
    p_reason: reason || null,
  });

  if (error) {
    redirectWithMessage(
      "error",
      ERROR_MESSAGES[error.message] ??
        "The review moderation action could not be completed.",
    );
  }

  redirectWithMessage("success", "Review moderation status updated.");
}
