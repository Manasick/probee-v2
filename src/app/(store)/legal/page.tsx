import Link from "next/link";
import { Container, Surface } from "@/components/ui";

const sections = [
  {
    title: "Privacy",
    body: "ProBee uses account, order and payment information to provide the store experience, process purchases, support customers and protect the service. Access to sensitive customer and payment information is restricted by the application authorization model.",
  },
  {
    title: "Terms of use",
    body: "Use of ProBee is subject to applicable laws and the specific terms presented with each product or purchase. Product descriptions, plans, durations, warranties and delivery requirements shown on the storefront form part of the relevant purchase information.",
  },
  {
    title: "Payments",
    body: "Available payment methods and payment instructions are shown during checkout. For manual bank transfers, payment status may remain pending until the submitted payment information is reviewed and verified.",
  },
  {
    title: "Digital delivery",
    body: "Digital products are made available only through authorized customer access after the applicable purchase and payment conditions are satisfied. Download or access availability can depend on the product and its configured entitlement period.",
  },
];

export default function LegalPage() {
  return (
    <section className="probee-section min-h-[70vh]">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">ProBee</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
            Legal & policies
          </h1>
          <p className="mt-5 text-base leading-7 text-text-secondary">
            General information about privacy, purchases, payments and digital
            delivery. Product-specific terms shown at checkout take precedence
            where applicable.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Surface key={section.title} className="p-6 sm:p-7">
              <p className="probee-label">{section.title}</p>
              <p className="mt-4 text-sm leading-7 text-text-secondary">
                {section.body}
              </p>
            </Surface>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--probee-gold-border)] bg-surface-1 p-6">
          <p className="text-sm leading-7 text-text-muted">
            This page is a general product-site information page, not legal
            advice. Before public commercial launch, replace or expand these
            sections with the final business-specific policies applicable to
            ProBee and its operating jurisdiction.
          </p>
          <Link
            href="/products"
            className="probee-primary-button probee-focus-ring mt-5 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold"
          >
            Back to products
          </Link>
        </div>
      </Container>
    </section>
  );
}
