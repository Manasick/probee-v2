import Link from "next/link";
import { AdminStatus } from "@/components/admin/admin-status";
import { Container, Surface } from "@/components/ui";
import { getAdminCategories, getAdminProductList } from "@/lib/admin/catalog";
import { formatPrice } from "@/lib/catalog/format";

type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function filterValue(value: SearchParamValue): "all" | "true" | "false" {
  const normalized = firstValue(value);

  return normalized === "true" || normalized === "false" ? normalized : "all";
}

function pageValue(value: SearchParamValue): number {
  const parsed = Number.parseInt(firstValue(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildPageHref(params: {
  search: string;
  published: string;
  active: string;
  featured: string;
  categoryId: string;
  page: number;
}): string {
  const query = new URLSearchParams();

  if (params.search) query.set("search", params.search);
  if (params.published !== "all") query.set("published", params.published);
  if (params.active !== "all") query.set("active", params.active);
  if (params.featured !== "all") query.set("featured", params.featured);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  query.set("page", String(params.page));

  return "/admin/products?" + query.toString();
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const query = await searchParams;
  const search = firstValue(query.search);
  const published = filterValue(query.published);
  const active = filterValue(query.active);
  const featured = filterValue(query.featured);
  const categoryId = firstValue(query.categoryId);
  const page = pageValue(query.page);

  const [result, categories] = await Promise.all([
    getAdminProductList({
      search,
      published,
      active,
      featured,
      categoryId,
      page,
    }),
    getAdminCategories(),
  ]);

  const hasProducts = result.items.length > 0;

  return (
    <section className="probee-section">
      <Container>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="probee-label">Products</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Product management
            </h1>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              Manage the real storefront catalog without editing source code.
            </p>
          </div>

          <Link
            href="/admin/products/new"
            className="probee-focus-ring inline-flex min-h-12 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-5 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
          >
            Create product
          </Link>
        </div>

        <Surface className="mt-8 p-4 sm:p-5">
          <form className="grid gap-3 lg:grid-cols-[1.8fr_repeat(4,1fr)_auto]">
            <div>
              <label
                htmlFor="product-search"
                className="mb-2 block text-sm font-medium text-text-secondary"
              >
                Search
              </label>
              <input
                id="product-search"
                name="search"
                defaultValue={search}
                placeholder="Name or slug"
                className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
              />
            </div>

            {[
              ["published", "Published"],
              ["active", "Active"],
              ["featured", "Featured"],
            ].map(([name, label]) => (
              <div key={name}>
                <label
                  htmlFor={"filter-" + name}
                  className="mb-2 block text-sm font-medium text-text-secondary"
                >
                  {label}
                </label>
                <select
                  id={"filter-" + name}
                  name={name}
                  defaultValue={
                    name === "published"
                      ? published
                      : name === "active"
                        ? active
                        : featured
                  }
                  className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                >
                  <option value="all">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            ))}

            <div>
              <label
                htmlFor="filter-category"
                className="mb-2 block text-sm font-medium text-text-secondary"
              >
                Category
              </label>
              <select
                id="filter-category"
                name="categoryId"
                defaultValue={categoryId}
                className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
              >
                <option value="">All categories</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="probee-focus-ring min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold hover:border-[var(--probee-border-strong)] hover:bg-surface-3"
              >
                Apply
              </button>
            </div>
          </form>
        </Surface>

        <div className="mt-8 hidden overflow-hidden rounded-[var(--probee-radius-lg)] border border-[var(--probee-border-subtle)] bg-surface-1 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--probee-border-subtle)] bg-surface-2 text-xs uppercase tracking-[0.08em] text-text-muted">
                <tr>
                  <th className="px-4 py-4 font-semibold">Product</th>
                  <th className="px-4 py-4 font-semibold">Category</th>
                  <th className="px-4 py-4 font-semibold">Plans</th>
                  <th className="px-4 py-4 font-semibold">Price</th>
                  <th className="px-4 py-4 font-semibold">State</th>
                  <th className="px-4 py-4 font-semibold">Order</th>
                  <th className="px-4 py-4 font-semibold">Updated</th>
                  <th className="px-4 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((product) => (
                  <tr key={product.id} className="border-b border-[var(--probee-border-subtle)] last:border-b-0">
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs text-text-muted">{product.slug}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-text-secondary">
                      {product.categories.length
                        ? product.categories.map((category) => category.name).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-4 align-top text-text-secondary">
                      {product.planCount}
                    </td>
                    <td className="px-4 py-4 align-top text-text-secondary">
                      {product.priceRange
                        ? product.priceRange.min === product.priceRange.max
                          ? formatPrice(
                              product.priceRange.min,
                              product.priceRange.currency,
                            )
                          : formatPrice(product.priceRange.min, product.priceRange.currency) +
                            " – " +
                            formatPrice(product.priceRange.max, product.priceRange.currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <AdminStatus
                          label={product.active ? "Active" : "Inactive"}
                          tone={product.active ? "success" : "neutral"}
                        />
                        <AdminStatus
                          label={product.published ? "Published" : "Draft"}
                          tone={product.published ? "success" : "neutral"}
                        />
                        {product.featured ? (
                          <AdminStatus label="Featured" tone="neutral" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-text-secondary">
                      {product.sortOrder}
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-text-muted">
                      {new Date(product.updatedAt).toLocaleString("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <Link
                        href={"/admin/products/" + product.id}
                        className="probee-focus-ring inline-flex min-h-9 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold text-text-primary hover:bg-surface-2"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:hidden">
          {result.items.map((product) => (
            <Surface key={product.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{product.name}</p>
                  <p className="mt-1 truncate text-xs text-text-muted">
                    {product.slug}
                  </p>
                </div>
                <Link
                  href={"/admin/products/" + product.id}
                  className="probee-focus-ring inline-flex min-h-10 shrink-0 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold"
                >
                  Edit
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Category</p>
                  <p className="mt-1 text-text-secondary">
                    {product.categories.length
                      ? product.categories.map((category) => category.name).join(", ")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Plans</p>
                  <p className="mt-1 text-text-secondary">{product.planCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Price</p>
                  <p className="mt-1 text-text-secondary">
                    {product.priceRange
                      ? product.priceRange.min === product.priceRange.max
                        ? formatPrice(
                            product.priceRange.min,
                            product.priceRange.currency,
                          )
                        : "Multiple"
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Order</p>
                  <p className="mt-1 text-text-secondary">{product.sortOrder}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <AdminStatus
                  label={product.active ? "Active" : "Inactive"}
                  tone={product.active ? "success" : "neutral"}
                />
                <AdminStatus
                  label={product.published ? "Published" : "Draft"}
                  tone={product.published ? "success" : "neutral"}
                />
                {product.featured ? <AdminStatus label="Featured" /> : null}
              </div>
            </Surface>
          ))}
        </div>

        {!hasProducts ? (
          <Surface className="mt-8 p-8 text-center sm:p-12">
            <p className="probee-label">Catalog is empty</p>
            <h2 className="mt-3 text-2xl font-semibold">
              Create your first product
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-muted">
              No real catalog products have been seeded. Use the product editor
              to create the first storefront record.
            </p>
            <Link
              href="/admin/products/new"
              className="probee-focus-ring mt-6 inline-flex min-h-11 items-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
            >
              Create your first product
            </Link>
          </Surface>
        ) : null}

        {hasProducts && result.pageCount > 1 ? (
          <nav
            className="mt-8 flex flex-wrap items-center justify-between gap-3"
            aria-label="Product pagination"
          >
            <p className="text-sm text-text-muted">
              Page {result.page} of {result.pageCount}
            </p>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Link
                  href={buildPageHref({
                    search,
                    published,
                    active,
                    featured,
                    categoryId,
                    page: result.page - 1,
                  })}
                  className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold hover:bg-surface-2"
                >
                  Previous
                </Link>
              ) : null}
              {result.page < result.pageCount ? (
                <Link
                  href={buildPageHref({
                    search,
                    published,
                    active,
                    featured,
                    categoryId,
                    page: result.page + 1,
                  })}
                  className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold hover:bg-surface-2"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </Container>
    </section>
  );
}
