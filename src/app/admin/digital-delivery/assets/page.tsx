import { Container, Surface } from "@/components/ui";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDigitalAssetSize } from "@/lib/digital-delivery/assets";
import { DigitalAssetUploader } from "@/components/admin/digital-asset-uploader";
import { setDigitalAssetActiveAction } from "../actions";

export const dynamic = "force-dynamic";

interface ProductRow {
  id: string;
  name: string;
  product_type: string;
  delivery_type: string | null;
  plans: Array<{
    id: string;
    name: string;
    delivery_type: string | null;
  }> | null;
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

export default async function DigitalDeliveryAssetsPage() {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: products }, { data: assets, error: assetsError }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id,name,product_type,delivery_type,plans:product_plans(id,name,delivery_type)",
        )
        .order("name", { ascending: true }),
      supabase
        .from("digital_delivery_assets")
        .select(
          "id,product_id,plan_id,title,description,mime_type,file_size_bytes,customer_instructions,is_active,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const productRows = (products ?? []) as ProductRow[];
  const assetRows = (assets ?? []) as AssetRow[];
  const productMap = new Map(
    productRows.map((product) => [product.id, product]),
  );

  const uploaderProducts = productRows
    .filter((product) =>
      ["digital", "license", "subscription"].includes(product.product_type),
    )
    .map((product) => ({
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
        <div className="max-w-4xl">
          <p className="probee-label">Digital delivery</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Secure digital files
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Upload private customer-delivery files for configured digital
            products and plans. Files are never public and are only exposed
            through entitlement-checked temporary access.
          </p>
        </div>

        <Surface className="mt-8 p-6 sm:p-8">
          <p className="probee-label">Upload a delivery asset</p>
          <h2 className="mt-2 text-xl font-semibold">Add a private file</h2>
          <div className="mt-6">
            <DigitalAssetUploader products={uploaderProducts} />
          </div>
        </Surface>

        <Surface className="mt-6 p-6 sm:p-8">
          <p className="probee-label">Registered assets</p>
          <h2 className="mt-2 text-xl font-semibold">Delivery library</h2>

          {assetsError ? (
            <div className="mt-5 rounded-[var(--probee-radius-md)] border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-100">
              Digital delivery assets could not be loaded.
            </div>
          ) : assetRows.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {assetRows.map((asset) => {
                const product = productMap.get(asset.product_id);
                const plan = product?.plans?.find(
                  (candidate) => candidate.id === asset.plan_id,
                );

                return (
                  <div
                    key={asset.id}
                    className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold">{asset.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {product?.name ?? "Product"}{" "}
                          {plan?.name ? "· " + plan.name : "· All plans"}
                        </p>
                        <p className="mt-2 text-xs text-text-muted">
                          {asset.mime_type} ·{" "}
                          {formatDigitalAssetSize(asset.file_size_bytes)}
                        </p>
                        {asset.description ? (
                          <p className="mt-2 text-sm leading-6 text-text-muted">
                            {asset.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
                            asset.is_active
                              ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-100"
                              : "border-amber-300/20 bg-amber-300/5 text-amber-100",
                          ].join(" ")}
                        >
                          {asset.is_active ? "Active" : "Inactive"}
                        </span>
                        <form action={setDigitalAssetActiveAction}>
                          <input type="hidden" name="assetId" value={asset.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={asset.is_active ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className="probee-focus-ring min-h-10 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3 text-xs font-semibold text-text-primary hover:bg-surface-3"
                          >
                            {asset.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-5">
              <p className="text-sm font-semibold">
                No digital files registered yet.
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Upload a private file for a configured digital product or plan
                to make it available for future entitlement fulfillment.
              </p>
            </div>
          )}
        </Surface>
      </Container>
    </section>
  );
}