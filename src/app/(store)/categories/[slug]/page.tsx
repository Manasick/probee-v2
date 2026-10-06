import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { ProductGrid } from "@/components/store/product-grid";
import { getPublicCatalogCategoryBySlug } from "@/lib/catalog/server";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicCatalogCategoryBySlug(slug);

  if (!data) {
    return {
      title: "Category not found | ProBee",
      description: "The requested ProBee category could not be found.",
    };
  }

  return {
    title: data.category.seoTitle ?? data.category.name + " | ProBee",
    description:
      data.category.seoDescription ??
      data.category.description ??
      data.category.name + " products on ProBee.",
  };
}

export default async function CategoryPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params;
  const data = await getPublicCatalogCategoryBySlug(slug);

  if (!data) {
    notFound();
  }

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Category</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            {data.category.name}
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            {data.category.description ??
              "Browse the published products available in this active category."}
          </p>
        </div>

        <div className="mt-10">
          <ProductGrid products={data.products} />
        </div>
      </Container>
    </section>
  );
}
