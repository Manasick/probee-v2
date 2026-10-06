import { Container, Surface } from "@/components/ui";
import { EmptyState } from "@/components/store/empty-state";
import { ManualBankTransferForm } from "@/components/store/manual-bank-transfer-form";
import { requireAuthenticated } from "@/lib/auth/server";
import { getActiveManualBankTransferSettings } from "@/lib/payments/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  payment_status: string;
  external_reference: string | null;
  amount: number | string;
  currency: string;
}

interface ProofRow {
  original_filename: string | null;
  file_size_bytes: number | null;
  verification_status: string;
}

export default async function ManualPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  await requireAuthenticated("/payment");

  const params = await searchParams;
  const orderReference = params.order?.trim() ?? "";

  if (!orderReference) {
    return (
      <section className="probee-section">
        <Container>
          <EmptyState
            title="Order reference required"
            description="Open the payment step from your order confirmation."
          />
        </Container>
      </section>
    );
  }

  const supabase = await createClient();

  const [{ data: order }, settings] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_reference,order_status,payment_status,total,currency")
      .eq("order_reference", orderReference)
      .maybeSingle(),
    getActiveManualBankTransferSettings(),
  ]);

  if (!order) {
    return (
      <section className="probee-section">
        <Container>
          <EmptyState
            title="Order not found"
            description="That order could not be found for your account."
          />
        </Container>
      </section>
    );
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id,payment_status,external_reference,amount,currency")
    .eq("order_id", order.id)
    .eq("payment_method", "manual_bank_transfer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: proof } = await supabase
    .from("payment_proofs")
    .select("original_filename,file_size_bytes,verification_status")
    .eq(
      "payment_id",
      payment?.id ?? "00000000-0000-0000-0000-000000000000",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderIsIneligible =
    order.order_status === "cancelled" ||
    order.order_status === "completed" ||
    order.order_status === "refunded";

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Payment</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Manual bank transfer
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Order {order.order_reference} is ready for the manual payment stage.
          </p>
        </div>

        <div className="mt-8">
          {Number(order.total) <= 0 ? (
            <Surface className="p-6 sm:p-8">
              <h2 className="text-xl font-semibold">No payment is required</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                This order has a zero balance, so a manual bank transfer is not required.
              </p>
            </Surface>
          ) : order.payment_status === "paid" ? (
            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Payment verified</p>
              <h2 className="mt-2 text-xl font-semibold">This order is already paid.</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                No additional manual bank-transfer submission is required.
              </p>
            </Surface>
          ) : orderIsIneligible ? (
            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Payment unavailable</p>
              <h2 className="mt-2 text-xl font-semibold">This order is no longer eligible for payment.</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                The order is in the {order.order_status} state and cannot accept a new manual payment submission.
              </p>
            </Surface>
          ) : (
            <ManualBankTransferForm
              orderReference={order.order_reference}
              amount={order.total}
              currency={order.currency}
              settings={settings}
              existingPayment={
                payment
                  ? {
                      paymentStatus: payment.payment_status,
                      externalReference: payment.external_reference,
                      amount: payment.amount,
                      currency: payment.currency,
                      proofFilename: (proof as ProofRow | null)?.original_filename ?? null,
                      proofSize: (proof as ProofRow | null)?.file_size_bytes ?? null,
                      proofStatus: (proof as ProofRow | null)?.verification_status ?? null,
                    }
                  : null
              }
            />
          )}
        </div>
      </Container>
    </section>
  );
}
