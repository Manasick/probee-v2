import { AdminErrorState } from "@/components/admin/admin-error-state";
import { ProductEditor } from "@/components/admin/product-editor";
import { getAdminProductEditorData } from "@/lib/admin/catalog";

export default async function NewProductPage() {
  try {
    const data = await getAdminProductEditorData();

    return (
      <ProductEditor
        mode="create"
        initialProduct={data.product}
        categories={data.categories}
      />
    );
  } catch (error) {
    return (
      <section className="probee-section">
        <div className="probee-container">
          <div className="max-w-3xl">
            <p className="probee-label">New product</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Create a product
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
