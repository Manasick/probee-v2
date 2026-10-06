import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/product-editor";
import { getAdminProductEditorData } from "@/lib/admin/catalog";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAdminProductEditorData(id);

  if (!data.product) {
    notFound();
  }

  return (
    <ProductEditor
      mode="edit"
      initialProduct={data.product}
      categories={data.categories}
    />
  );
}
