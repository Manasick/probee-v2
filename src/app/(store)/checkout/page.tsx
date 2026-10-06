import Link from "next/link";
import { Container, Surface } from "@/components/ui";

export default function CheckoutPage() {
  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Checkout</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Checkout foundation
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            This route reserves space for customer details, order review and future payment methods without implementing checkout logic yet.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Surface className="p-6">
            <h2 className="text-lg font-semibold">Customer details</h2>
            <div className="mt-4 grid gap-4 text-sm text-text-muted">
              <div className="rounded-[var(--probee-radius-md)] border border-dashed border-[var(--probee-border-default)] p-5">
                Customer form structure will be added with the authentication and checkout flow.
              </div>
            </div>
          </Surface>

          <Surface className="p-6">
            <h2 className="text-lg font-semibold">Order review</h2>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              Trusted totals, payment status and order creation will be handled server-side in a later step.
            </p>
            <div className="mt-6">
              <Link
                href="/cart"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary transition-colors hover:border-[var(--probee-border-strong)] hover:bg-surface-3 probee-focus-ring"
              >
                Back to cart
              </Link>
            </div>
          </Surface>
        </div>
      </Container>
    </section>
  );
}
