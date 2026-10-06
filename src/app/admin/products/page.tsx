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

  let result;
  let categories;
  [result, categories] = await Promise.all([
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
}
