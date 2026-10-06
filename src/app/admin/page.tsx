import Link from "next/link";
import { Container, Surface } from "@/components/ui";

export default function AdminDashboardPage() {
  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Admin dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            ProBee administration
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Product management is the first live administration module. Other
            operational areas are intentionally reserved for later stages.
          </p>
        </div>

        <Surface className="mt-8 p-6 sm:p-8">
          <p className="text-sm font-semibold text-text-primary">
            Dashboard metrics are not implemented in STEP 7.
          </p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            No fake statistics or placeholder business data are shown here.
          </p>
          <Link
            href="/admin/products"
            className="probee-focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
          >
            Manage products
          </Link>
        </Surface>
      </Container>
    </section>
  );
}
