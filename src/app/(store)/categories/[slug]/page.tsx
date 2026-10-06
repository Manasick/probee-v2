import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { ProductGrid } from "@/components/store/product-grid";

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
  const name = formatSlug(slug);

  return {
    title: `${name} | ProBee`,
    description: `${name} products on ProBee.`,
  };
}

export default async function CategoryPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params;
  const name = formatSlug(slug);

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Category</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            {name || "Category"}
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Category details and published products will be loaded from the catalog layer.
          </p>
        </div>

        <div className="mt-10">
          <ProductGrid products={[]} />
        </div>
      </Container>
    </section>
  );
}
