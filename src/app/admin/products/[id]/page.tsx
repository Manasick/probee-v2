import { AdminErrorState } from "@/components/admin/admin-error-state";
import { ProductEditor } from "@/components/admin/product-editor";
import { getAdminProductEditorData } from "@/lib/admin/catalog";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const data = await getAdminProductEditorData(id);

    if (!data.product) {
      return (
        <section className="probee-section">
          <div className="probee-container">
            <div className="max-w-3xl">
              <p className="probee-label">Edit product</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
                Product not found
              </h1>
            </div>
            <AdminErrorState message="That product does not exist or is no longer available to this administrator." />
          </div>
        </section>
      );
    }

    return (
      <ProductEditor
        mode="edit"
        initialProduct={data.product}
        categories={data.categories}
      />
    );
  } catch (error) {
    return (
      <section className="probee-section">
        <div className="probee-container">
          <div className="max-w-3xl">
            <p className="probee-label">Edit product</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Unable to load product
            </h1>
          </div>
          <AdminErrorState
            message={
              error instanceof Error
                ? error.message
                : "The product editor could not be loaded."
            }
          />
        </div>
      </section>
    );
  }
}
