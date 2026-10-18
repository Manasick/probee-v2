import Link from "next/link";
import { AccountNav } from "@/components/store/account-nav";
import { EmptyState } from "@/components/store/empty-state";
import { StatusBadge } from "@/components/store/status-badge";
import { Container, Surface } from "@/components/ui";
import { requireAuthenticated } from "@/lib/auth/server";
import { formatCurrency, formatDate, getPaymentMethodLabel } from "@/lib/orders/presentation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  order_id: string;
  payment_method: string;
  payment_status: string;
  amount: number | string;
  currency: string;
  external_reference: string | null;
  verified_at: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  order_reference: string;
}

export default async function AccountTransactionsPage() {
  const context = await requireAuthenticated("/account/transactions");
  const supabase = await createClient();

  // Scope the payment lookup to orders owned by the authenticated customer.
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,order_reference")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false });

  const ownedOrders = (orders ?? []) as OrderRow[];
  const orderReferenceById = new Map(ownedOrders.map((order) => [order.id, order.order_reference]));

  let payments: PaymentRow[] = [];
  let paymentsError = ordersError;

  if (!ordersError && ownedOrders.length > 0) {
    const result = await supabase
      .from("payments")
      .select("id,order_id,payment_method,payment_status,amount,currency,external_reference,verified_at,created_at")
      .in("order_id", ownedOrders.map((order) => order.id))
      .order("created_at", { ascending: false });

    payments = (result.data ?? []) as PaymentRow[];
    paymentsError = result.error;
  }

  return (
    <section className="probee-section probee-transactions-page">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Account activity</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Transactions & payments</h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Review payment records connected to your ProBee orders, including status, amount and transfer reference.
          </p>
        </div>

        <div className="mt-8">
          <AccountNav />
        </div>

        {paymentsError ? (
          <Surface className="mt-8 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="text-sm font-semibold text-red-100">Payment history is temporarily unavailable.</p>
            <p className="mt-2 text-sm leading-6 text-red-100/70">Please refresh this page or try again later.</p>
          </Surface>
        ) : payments.length > 0 ? (
          <>
            <div className="probee-transaction-summary mt-8 flex flex-col gap-2 rounded-[var(--probee-radius-lg)] border border-[var(--probee-border-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="probee-label">Payment records</p>
                <p className="mt-2 text-2xl font-semibold">{payments.length}</p>
              </div>
              <p className="max-w-lg text-sm leading-6 text-text-muted">
                Only payments linked to orders in your account are shown here. For proof review or next steps, open the related order.
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              {payments.map((payment) => {
                const reference = orderReferenceById.get(payment.order_id);
                return (
                  <Surface key={payment.id} tone="interactive" className="probee-transaction-card p-4 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="probee-label">Payment record</p>
                        <p className="mt-2 text-lg font-semibold">{getPaymentMethodLabel(payment.payment_method)}</p>
                        <p className="mt-1 text-xs text-text-muted">{formatDate(payment.created_at)}</p>
                        {reference ? (
                          <Link
                            href={"/account/orders/" + encodeURIComponent(reference)}
                            className="probee-focus-ring mt-3 inline-flex rounded text-sm font-semibold text-gold hover:text-gold-hover"
                          >
                            Order {reference} →
                          </Link>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <StatusBadge kind="payment" status={payment.payment_status} />
                      </div>
                    </div>

                    <div className="probee-transaction-details mt-5 grid gap-4 border-t border-[var(--probee-border-subtle)] pt-5 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Amount</p>
                        <p className="mt-1 text-xl font-semibold text-text-primary">{formatCurrency(payment.amount, payment.currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Transfer reference</p>
                        <p className="mt-1 break-words text-sm font-medium text-text-primary">
                          {payment.external_reference || "Not provided"}
                        </p>
                        {payment.verified_at ? (
                          <p className="mt-1 text-xs text-text-muted">Verified {formatDate(payment.verified_at)}</p>
                        ) : null}
                      </div>
                    </div>
                  </Surface>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-8">
            <EmptyState
              title="No payment records yet"
              description="Payment records will appear here when a payment is created for one of your orders."
              action={
                <Link href="/account/orders" className="probee-focus-ring inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary hover:bg-surface-3">
                  View orders
                </Link>
              }
            />
          </div>
        )}
      </Container>
    </section>
  );
}
