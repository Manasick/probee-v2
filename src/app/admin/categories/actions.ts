"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { isUuid } from "@/lib/admin/validation";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function value(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function resultRedirect(type: "success" | "error", message: string): never {
  redirect("/admin/categories?" + type + "=" + encodeURIComponent(message));
}

function errorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "That category slug already exists.";
  if (error.code === "23514") return "The category values do not satisfy the catalog rules.";
  return "The category could not be saved. Please try again.";
}

export async function saveCategoryAction(formData: FormData) {
  await requireStaff();

  const id = value(formData, "id");
  const name = value(formData, "name");
  const slug = value(formData, "slug").toLowerCase();
  const description = value(formData, "description");
  const seoTitle = value(formData, "seoTitle");
  const seoDescription = value(formData, "seoDescription");
  const sortOrder = Number.parseInt(value(formData, "sortOrder") || "0", 10);
  const isActive = formData.get("isActive") === "on";

  if (!name || name.length > 180) resultRedirect("error", "Category name is required and must be 180 characters or fewer.");
  if (!SLUG_PATTERN.test(slug)) resultRedirect("error", "Slug must contain lowercase letters, numbers, and single hyphens only.");
  if (!Number.isInteger(sortOrder) || sortOrder < 0) resultRedirect("error", "Display order must be a whole number greater than or equal to 0.");
  if (seoTitle.length > 180 || seoDescription.length > 500) resultRedirect("error", "SEO fields exceed the allowed length.");
  if (description.length > 2000) resultRedirect("error", "Description is too long.");

  const supabase = await createClient();
  const payload = {
    name,
    slug,
    description: description || null,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    is_active: isActive,
    sort_order: sortOrder,
  };

  const query = isUuid(id)
    ? supabase.from("categories").update(payload).eq("id", id)
    : supabase.from("categories").insert(payload);

  const { error } = await query;
  if (error) resultRedirect("error", errorMessage(error));

  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  resultRedirect("success", "Category saved successfully.");
}

export async function setCategoryActiveAction(formData: FormData) {
  await requireStaff();
  const id = value(formData, "id");
  if (!isUuid(id)) return;

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("is_active").eq("id", id).maybeSingle();
  if (!data) return;

  await supabase.from("categories").update({ is_active: !data.is_active }).eq("id", id);
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
}
