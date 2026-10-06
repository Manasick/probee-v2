import { Container } from "@/components/ui";
import { CheckoutForm } from "@/components/store/checkout-form";
import { requireAuthenticated } from "@/lib/auth/server";
import { getActiveManualBankTransferSettings } from "@/lib/payments/server";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [context, manualBankTransferSettings] = await Promise.all([
    requireAuthenticated("/checkout"),
    getActiveManualBankTransferSettings(),
  ]);

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Checkout</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Complete your order.
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Review the current catalog pricing and confirm your customer details before placing the order.
          </p>
        </div>

        <div className="mt-8">
          <CheckoutForm
            initialEmail={context.user.email ?? ""}
            initialName={context.profile.displayName}
            initialPhone={context.profile.phone}
            manualBankTransferEnabled={Boolean(manualBankTransferSettings)}
          />
        </div>
      </Container>
    </section>
  );
}
