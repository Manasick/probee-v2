"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect("/account/reviews?" + type + "=" + encodeURIComponent(message));
}

function parseRating(formData: FormData): number | null {
  const value = Number(formData.get("rating"));
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

function parseText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

const ERROR_MESSAGES: Record<string, string> = {
  "review:auth_required": "Please sign in before writing a review.",
  "review:product_invalid": "The product reference is invalid.",
  "review:product_not_found": "That product is no longer available for review.",
  "review:rating_invalid": "Choose a rating from 1 to 5 stars.",
  "review:title_too_long": "The review title is too long.",
  "review:body_invalid": "Write a review before submitting it.",
  "review:purchase_required":
    "A successful paid purchase is required before you can review this product.",
  "review:already_exists":
    "You already have a review for this product. Edit your existing review instead.",
  "review:not_found": "That review could not be found in your account.",
};

export async function createReviewAction(formData: FormData) {
  const productId = formData.get("productId");

  if (typeof productId !== "string") {
    redirectWithMessage("error", ERROR_MESSAGES["review:product_invalid"]);
  }

  const rating = parseRating(formData);
  const title = parseText(formData.get("title"));
  const body = parseText(formData.get("body"));

  if (title.length > 120) {
    redirectWithMessage("error", ERROR_MESSAGES["review:title_too_long"]);
  }

  if (body.length < 1 || body.length > 2000) {
    redirectWithMessage("error", ERROR_MESSAGES["review:body_invalid"]);
  }

  if (!rating) {
    redirectWithMessage("error", ERROR_MESSAGES["review:rating_invalid"]);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_product_review", {
    p_product_id: productId,
    p_rating: rating,
    p_title: title || null,
    p_body: body,
  });

  if (error) {
    redirectWithMessage(
      "error",
      ERROR_MESSAGES[error.message] ??
        "Your review could not be submitted. Please try again.",
    );
  }

  redirectWithMessage(
    "success",
    "Your review was submitted and is pending moderation.",
  );
}

export async function updateReviewAction(formData: FormData) {
  const reviewId = formData.get("reviewId");

  if (typeof reviewId !== "string") {
    redirectWithMessage("error", ERROR_MESSAGES["review:not_found"]);
  }

  const rating = parseRating(formData);
  const title = parseText(formData.get("title"));
  const body = parseText(formData.get("body"));

  if (title.length > 120) {
    redirectWithMessage("error", ERROR_MESSAGES["review:title_too_long"]);
  }

  if (body.length < 1 || body.length > 2000) {
    redirectWithMessage("error", ERROR_MESSAGES["review:body_invalid"]);
  }

  if (!rating) {
    redirectWithMessage("error", ERROR_MESSAGES["review:rating_invalid"]);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_product_review", {
    p_review_id: reviewId,
    p_rating: rating,
    p_title: title || null,
    p_body: body,
  });

  if (error) {
    redirectWithMessage(
      "error",
      ERROR_MESSAGES[error.message] ??
        "Your review could not be updated. Please try again.",
    );
  }

  redirectWithMessage(
    "success",
    "Your review was updated and returned to moderation.",
  );
}
