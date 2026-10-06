import { Container, Surface } from "@/components/ui";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { saveCategoryAction, setCategoryActiveAction } from "./actions";
import { AdminStatus } from "@/components/admin/admin-status";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;
  const success = Array.isArray(params.success) ? params.success[0] ?? "" : params.success ?? "";
  const errorMessage = Array.isArray(params.error) ? params.error[0] ?? "" : params.error ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,is_active,sort_order,seo_title,seo_description")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Categories</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Category management</h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Categories are managed in the real catalog. Public storefront queries only expose active categories.
          </p>
        </div>

        {success ? <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4"><p className="text-sm text-emerald-100">{success}</p></Surface> : null}
        {errorMessage ? <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4" role="alert"><p className="text-sm text-red-100">{errorMessage}</p></Surface> : null}

        {error ? (
          <Surface className="mt-8 p-6 border-red-300/20 bg-red-300/5" role="alert">
            <p className="font-semibold text-red-100">Categories could not be loaded.</p>
            <p className="mt-2 text-sm text-red-100/70">Refresh the page and try again.</p>
          </Surface>
        ) : (
          <>
            <Surface className="mt-8 p-5 sm:p-6">
              <p className="probee-label">Create category</p>
              <h2 className="mt-2 text-xl font-semibold">New catalog category</h2>
              <form action={saveCategoryAction} className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-text-secondary">
                    Name
                    <input name="name" required maxLength={180} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-text-secondary">
                    Slug
                    <input name="slug" required maxLength={180} placeholder="category-slug" className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-medium text-text-secondary">
                  Description
                  <textarea name="description" maxLength={2000} rows={3} className="rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 py-3 text-sm text-text-primary" />
                </label>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-2 text-sm font-medium text-text-secondary">
                    SEO title
                    <input name="seoTitle" maxLength={180} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-text-secondary sm:col-span-2">
                    SEO description
                    <input name="seoDescription" maxLength={500} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="grid gap-2 text-sm font-medium text-text-secondary">
                    Display order
                    <input name="sortOrder" type="number" min="0" inputMode="numeric" defaultValue="0" className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3">
                    <input name="isActive" type="checkbox" defaultChecked className="size-5 accent-[var(--probee-gold)]" />
                    <span className="text-sm font-semibold">Active</span>
                  </label>
                </div>
                <button className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse sm:w-fit" type="submit">Create category</button>
              </form>
            </Surface>

            <div className="mt-8 grid gap-4">
              {(data ?? []).map((category) => (
                <Surface key={category.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold">{category.name}</p>
                      <p className="mt-1 text-xs text-text-muted">{category.slug} · Order {category.sort_order}</p>
                      <div className="mt-2"><AdminStatus label={category.is_active ? "Active" : "Inactive"} tone={category.is_active ? "success" : "neutral"} /></div>
                    </div>
                    <form action={setCategoryActiveAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <button type="submit" className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold">
                        {category.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </div>

                  <form action={saveCategoryAction} className="mt-5 grid gap-4 border-t border-[var(--probee-border-subtle)] pt-5">
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="isActive" value={category.is_active ? "on" : ""} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-text-secondary">Name<input name="name" required maxLength={180} defaultValue={category.name} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
                      <label className="grid gap-2 text-sm font-medium text-text-secondary">Slug<input name="slug" required maxLength={180} defaultValue={category.slug} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
                    </div>
                    <label className="grid gap-2 text-sm font-medium text-text-secondary">Description<textarea name="description" maxLength={2000} rows={3} defaultValue={category.description ?? ""} className="rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 py-3 text-sm text-text-primary" /></label>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="grid gap-2 text-sm font-medium text-text-secondary">SEO title<input name="seoTitle" maxLength={180} defaultValue={category.seo_title ?? ""} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
                      <label className="grid gap-2 text-sm font-medium text-text-secondary sm:col-span-2">SEO description<input name="seoDescription" maxLength={500} defaultValue={category.seo_description ?? ""} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
                    </div>
                    <label className="grid gap-2 text-sm font-medium text-text-secondary sm:max-w-xs">Display order<input name="sortOrder" type="number" min="0" defaultValue={category.sort_order} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" /></label>
                    <input type="hidden" name="isActive" value={category.is_active ? "on" : ""} />
                    <button className="probee-focus-ring min-h-11 w-full rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold sm:w-fit" type="submit">Save changes</button>
                  </form>
                </Surface>
              ))}

              {(data ?? []).length === 0 ? (
                <Surface className="p-8 text-center"><p className="font-semibold">No categories yet.</p><p className="mt-2 text-sm text-text-muted">Create the first category above.</p></Surface>
              ) : null}
            </div>
          </>
        )}
      </Container>
    </section>
  );
}
