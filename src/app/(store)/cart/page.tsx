import Link from "next/link";
import { Container } from "@/components/ui";
import { EmptyState } from "@/components/store/empty-state";

export default function CartPage() {
  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Cart</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Your cart
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            The cart route is visually ready for the future cart state and order preparation layer.
          </p>
        </div>

        <div className="mt-8">
          <EmptyState
            title="Your cart is empty"
            description="Cart state, item quantities and trusted price calculations will be implemented in a later step."
            action={
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-gold-hover probee-focus-ring"
              >
                Continue shopping
              </Link>
            }
          />
        </div>
      </Container>
    </section>
  );
}
