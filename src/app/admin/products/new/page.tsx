import { ProductEditor } from "@/components/admin/product-editor";
import { getAdminProductEditorData } from "@/lib/admin/catalog";

export default async function NewProductPage() {
  const data = await getAdminProductEditorData();

  return (
    <ProductEditor
      mode="create"
      initialProduct={data.product}
      categories={data.categories}
    />
  );
}
