import { Container, Surface } from "@/components/ui";
import { CheckoutCartStatus } from "@/components/store/checkout-cart-status";

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
            Your cart is available here for the future trusted checkout flow.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <CheckoutCartStatus />

          <Surface className="p-6">
            <h2 className="text-lg font-semibold">Next-stage checkout</h2>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              Customer details, server-side total validation, order creation,
              and payment handling are intentionally not enabled in this step.
            </p>
          </Surface>
        </div>
      </Container>
    </section>
  );
}
