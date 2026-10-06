import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Surface } from "@/components/ui";

const sections: Record<
  string,
  { title: string; description: string }
> = {
  categories: {
    title: "Categories",
    description:
      "Category management is reserved for a future administration stage.",
  },
  orders: {
    title: "Orders",
    description:
      "Order operations are intentionally not implemented in STEP 7.",
  },
  customers: {
    title: "Customers",
    description:
      "Customer management will be added with the authenticated customer layer.",
  },
  payments: {
    title: "Payments",
    description:
      "Payment operations are reserved for a later implementation stage.",
  },
  settings: {
    title: "Settings",
    description:
      "Administrative settings are reserved for a future implementation stage.",
  },
};

export default async function AdminPlaceholderPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = sections[section];

  if (!item) {
    notFound();
  }

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Coming later</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            {item.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            {item.description}
          </p>
        </div>

        <Surface className="mt-8 p-6 sm:p-8">
          <p className="text-sm font-semibold">This section is not implemented.</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            STEP 7 intentionally limits real functionality to Products.
          </p>
          <Link
            href="/admin/products"
            className="probee-focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary hover:border-[var(--probee-border-strong)] hover:bg-surface-3"
          >
            Return to products
          </Link>
        </Surface>
      </Container>
    </section>
  );
}
