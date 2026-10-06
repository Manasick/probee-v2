import { Container, Surface } from "@/components/ui";
import { AdminStatus } from "@/components/admin/admin-status";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDigitalAssetSize } from "@/lib/digital-delivery/assets";
import { sanitizeSearchTerm } from "@/lib/admin/validation";
import { DigitalAssetUploader } from "@/components/admin/digital-asset-uploader";
import { AdminConfirmForm } from "@/components/admin/admin-confirm-form";
import {
  deleteDigitalAssetAction,
  setDigitalAssetActiveAction,
} from "../actions";

export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;
function value(input: Param): string {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}
function pageValue(input: Param): number {
  const n = Number.parseInt(value(input), 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
function href(search: string, page: number) {
  const q = new URLSearchParams();
  if (search) q.set("search", search);
  q.set("page", String(page));
  return "/admin/digital-delivery/assets?" + q.toString();
}

interface ProductRow {
  id: string;
  name: string;
  product_type: string;
  delivery_type: string | null;
  plans: Array<{ id: string; name: string; delivery_type: string | null }> | null;
}

interface AssetRow {
  id: string;
  product_id: string;
  plan_id: string | null;
  title: string;
  description: string | null;
  mime_type: string;
  file_size_bytes: number;
  customer_instructions: string | null;
  is_active: boolean;
  created_at: string;
}

export default async function DigitalDeliveryAssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, Param>>;
}) {
  await requireStaff();
  const params = await searchParams;
  const search = sanitizeSearchTerm(value(params.search));
  const page = pageValue(params.page);
  const pageSize = 20;
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [{ data: assets, count: assetCount, error: assetsError }, { data: products }] =
    await Promise.all([
      supabase
        .from("digital_delivery_assets")
        .select("id,product_id,plan_id,title,description,mime_type,file_size_bytes,customer_instructions,is_active,created_at", { count: "exact" })
        .ilike("title", "%" + search + "%")
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("products")
        .select("id,name,product_type,delivery_type,plans:product_plans(id,name,delivery_type)")
        .in("product_type", ["digital", "license", "subscription"])
        .order("name", { ascending: true })
        .limit(200),
    ]);

  const assetRows = (assets ?? []) as AssetRow[];
  const productRows = (products ?? []) as ProductRow[];
  const productMap = new Map(productRows.map((product) => [product.id, product]));
  const pageCount = Math.max(1, Math.ceil((assetCount ?? 0) / pageSize));

  const uploaderProducts = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    deliveryType: product.delivery_type,
    plans: (product.plans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      deliveryType: plan.delivery_type,
    })),
  }));

  return (
    <section className="probee-section">
      <Container>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-4xl">
            <p className="probee-label">Digital delivery</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Secure digital assets</h1>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              Private delivery files remain in the existing secure storage bucket. Assets already linked to customer entitlements cannot be deleted.
            </p>
          </div>
          <a href="/admin/digital-delivery" className="probee-focus-ring inline-flex min-h-11 items-center rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold">Back to fulfillment</a>
        </div>

        <Surface className="mt-8 p-6 sm:p-8">
          <p className="probee-label">Upload a delivery asset</p>
          <h2 className="mt-2 text-xl font-semibold">Add a private file</h2>
          <div className="mt-6"><DigitalAssetUploader products={uploaderProducts} /></div>
        </Surface>

        <Surface className="mt-6 p-4 sm:p-5">
          <form className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="asset-search">Search assets</label>
            <input id="asset-search" name="search" defaultValue={search} placeholder="Search asset title" className="min-h-11 flex-1 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
            <button type="submit" className="probee-focus-ring min-h-11 rounded-lg bg-gold px-5 text-sm font-semibold text-text-inverse">Search</button>
          </form>
        </Surface>

        {assetsError ? (
          <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="font-semibold text-red-100">Digital assets could not be loaded.</p>
            <p className="mt-2 text-sm text-red-100/70">Refresh the page and try again.</p>
          </Surface>
        ) : (
          <div className="mt-6 grid gap-4">
            {assetRows.map((asset) => {
              const product = productMap.get(asset.product_id);
              const plan = product?.plans?.find((candidate) => candidate.id === asset.plan_id);
              return (
                <Surface key={asset.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{asset.title}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {product?.name ?? "Product"}{plan?.name ? " · " + plan.name : " · All plans"}
                      </p>
                      <p className="mt-2 text-xs text-text-muted">
                        {asset.mime_type} · {formatDigitalAssetSize(asset.file_size_bytes)} · {new Date(asset.created_at).toLocaleString()}
                      </p>
                      {asset.description ? <p className="mt-2 text-sm leading-6 text-text-muted">{asset.description}</p> : null}
                      {asset.customer_instructions ? <p className="mt-2 text-xs text-text-muted">Customer delivery instructions configured.</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatus label={asset.is_active ? "Active" : "Inactive"} tone={asset.is_active ? "success" : "neutral"} />
                      <form action={setDigitalAssetActiveAction}>
                        <input type="hidden" name="assetId" value={asset.id} />
                        <input type="hidden" name="isActive" value={asset.is_active ? "false" : "true"} />
                        <button type="submit" className="probee-focus-ring min-h-10 rounded-lg border border-[var(--probee-border-default)] px-3 text-xs font-semibold">{asset.is_active ? "Deactivate" : "Activate"}</button>
                      </form>
                      <AdminConfirmForm
                        action={deleteDigitalAssetAction}
                        fields={{ assetId: asset.id }}
                        confirmation="Delete this private asset permanently? Assets already linked to customer entitlements are protected."
                      >
                        <button type="submit" className="probee-focus-ring min-h-10 rounded-lg border border-red-300/20 bg-red-300/5 px-3 text-xs font-semibold text-red-100">Delete</button>
                      </AdminConfirmForm>
                    </div>
                  </div>
                </Surface>
              );
            })}
            {assetRows.length === 0 ? <Surface className="p-8 text-center"><p className="font-semibold">No digital assets found.</p><p className="mt-2 text-sm text-text-muted">Upload a real private delivery file to build the asset library.</p></Surface> : null}
          </div>
        )}

        {pageCount > 1 ? (
          <nav className="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Digital asset pagination">
            <p className="text-sm text-text-muted">Page {page} of {pageCount}</p>
            <div className="flex gap-2">
              {page > 1 ? <a href={href(search, page - 1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Previous</a> : null}
              {page < pageCount ? <a href={href(search, page + 1)} className="probee-focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--probee-border-default)] px-3 text-sm font-semibold">Next</a> : null}
            </div>
          </nav>
        ) : null}
      </Container>
    </section>
  );
}
