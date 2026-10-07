import { Container } from "@/components/ui";
import { CartView } from "@/components/store/cart-view";

export default function CartPage() {
  return (
    <section className="probee-section probee-cart-page">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Your ProBee selection</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Your cart
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Review your selected plans and quantities before continuing.
          </p>
        </div>

        <div className="mt-8">
          <CartView />
        </div>
      </Container>
    </section>
  );
}
