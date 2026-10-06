import { Container, Surface } from "@/components/ui";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import {
  markManualPaymentPaidAction,
  rejectManualPaymentAction,
  saveManualBankTransferSettingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  order_id: string;
  payment_method: string;
  payment_status: string;
  amount: number | string;
  currency: string;
  external_reference: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  order_reference: string;
  user_id: string | null;
  order_status: string;
  customer_email: string | null;
  customer_name: string | null;
}

interface ProofRow {
  id: string;
  payment_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
}

function formatAmount(amount: number | string, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function formatFileSize(size: number | null): string {
  if (!size || size <= 0) {
    return "Unknown size";
  }

  const megabytes = size / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("current_user_is_admin");

  const [
    { data: settings },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    isAdmin
      ? supabase
          .from("payment_settings")
          .select(
            "payment_method,enabled,bank_name,account_name,account_number,branch,bank_code_swift,payment_instructions",
          )
          .eq("payment_method", "manual_bank_transfer")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("payments")
      .select(
        "id,order_id,payment_method,payment_status,amount,currency,external_reference,verified_by,verified_at,created_at,order:orders(id,order_reference,user_id,order_status,customer_email,customer_name)",
      )
      .eq("payment_method", "manual_bank_transfer")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const paymentRows = (payments ?? []) as Array<
    PaymentRow & { order: OrderRow | OrderRow[] | null }
  >;

  const paymentIds = paymentRows.map((payment) => payment.id);
  let proofs: ProofRow[] = [];

  if (paymentIds.length > 0) {
    const { data } = await supabase
      .from("payment_proofs")
      .select(
        "id,payment_id,storage_path,original_filename,mime_type,file_size_bytes,verification_status,verified_at,created_at",
      )
      .in("payment_id", paymentIds)
      .order("created_at", { ascending: false });

    proofs = (data ?? []) as ProofRow[];
  }

  const latestProofByPayment = new Map<string, ProofRow>();
  for (const proof of proofs) {
    if (!latestProofByPayment.has(proof.payment_id)) {
      latestProofByPayment.set(proof.payment_id, proof);
    }
  }

  const signedProofUrls = new Map<string, string>();
  for (const proof of latestProofByPayment.values()) {
    const { data } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(proof.storage_path, 60 * 10);

    if (data?.signedUrl) {
      signedProofUrls.set(proof.id, data.signedUrl);
    }
  }

  const params = await searchParams;

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Payments</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Manual bank transfer
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Review customer payment references and proofs using the existing staff authorization layer.
          </p>
        </div>

        {params.success ? (
          <Surface className="mt-6 border border-emerald-300/20 bg-emerald-300/5 p-4">
            <p className="text-sm text-emerald-100">{params.success}</p>
          </Surface>
        ) : null}
        {params.error ? (
          <Surface className="mt-6 border border-red-300/20 bg-red-300/5 p-4">
            <p className="text-sm text-red-100">{params.error}</p>
          </Surface>
        ) : null}

        {isAdmin ? (
          <Surface className="mt-8 p-6 sm:p-8">
            <div>
              <p className="probee-label">Bank transfer settings</p>
              <h2 className="mt-2 text-xl font-semibold">
                Customer-facing payment instructions
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Only active settings are visible to authenticated customers.
              </p>
            </div>

            <form action={saveManualBankTransferSettingsAction} className="mt-6 grid gap-5">
              <label className="flex min-h-11 items-center justify-between gap-4 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4">
                <span>
                  <span className="block text-sm font-semibold">Manual bank transfer</span>
                  <span className="block text-xs text-text-muted">Enable customer payment submissions.</span>
                </span>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={Boolean(settings?.enabled)}
                  className="size-5 accent-[var(--probee-gold)]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-text-secondary">
                  Bank name
                  <input
                    name="bankName"
                    defaultValue={settings?.bank_name ?? ""}
                    maxLength={120}
                    className="min-h-11 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-text-secondary">
                  Account name
                  <input
                    name="accountName"
                    defaultValue={settings?.account_name ?? ""}
                    maxLength={120}
                    className="min-h-11 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-text-secondary">
                  Account number
                  <input
                    name="accountNumber"
                    defaultValue={settings?.account_number ?? ""}
                    maxLength={120}
                    className="min-h-11 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-text-secondary">
                  Branch
                  <input
                    name="branch"
                    defaultValue={settings?.branch ?? ""}
                    maxLength={120}
                    className="min-h-11 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-text-secondary sm:col-span-2">
                  Bank code / SWIFT
                  <input
                    name="bankCodeSwift"
                    defaultValue={settings?.bank_code_swift ?? ""}
                    maxLength={120}
                    className="min-h-11 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Payment instructions
                <textarea
                  name="paymentInstructions"
                  defaultValue={settings?.payment_instructions ?? ""}
                  maxLength={5000}
                  rows={6}
                  className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 py-3 text-sm leading-6 text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                />
              </label>

              <button
                type="submit"
                className="probee-focus-ring inline-flex min-h-11 w-fit items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
              >
                Save bank transfer settings
              </button>
            </form>

            <p className="mt-4 text-xs leading-5 text-text-muted">
              Updated by the currently authenticated administrator: {staff.user.email ?? "account"}
            </p>
          </Surface>
        ) : (
          <Surface className="mt-8 p-6">
            <p className="text-sm text-text-muted">
              Bank-transfer settings are editable only by authorized administrators.
            </p>
          </Surface>
        )}

        <div className="mt-8 grid gap-4">
          {paymentsError ? (
            <Surface className="p-6">
              <p className="text-sm text-red-200">
                Payment records could not be loaded.
              </p>
            </Surface>
          ) : null}

          {paymentRows.length === 0 ? (
            <Surface className="p-6">
              <p className="text-sm font-semibold">No manual bank-transfer payments yet.</p>
              <p className="mt-2 text-sm text-text-muted">
                Customer submissions will appear here after the payment method is enabled.
              </p>
            </Surface>
          ) : null}

          {paymentRows.map((payment) => {
            const order = Array.isArray(payment.order)
              ? payment.order[0]
              : payment.order;
            const proof = latestProofByPayment.get(payment.id);
            const proofUrl = proof ? signedProofUrls.get(proof.id) : null;

            return (
              <Surface key={payment.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="probee-label">Order {order?.order_reference ?? "Unknown"}</p>
                    <h2 className="mt-2 text-lg font-semibold">
                      {order?.customer_name || order?.customer_email || "Customer"}
                    </h2>
                    <p className="mt-1 text-sm text-text-muted">
                      {order?.customer_email ?? "No email"}
                    </p>
                  </div>

                  <span className="rounded-full border border-[var(--probee-border-default)] bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-text-secondary">
                    {payment.payment_status}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-text-muted">Amount</p>
                    <p className="mt-1 font-semibold text-gold">
                      {formatAmount(payment.amount, payment.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Payment reference</p>
                    <p className="mt-1 font-medium text-text-primary">
                      {payment.external_reference ?? "Not supplied"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Order status</p>
                    <p className="mt-1 text-text-secondary">
                      {order?.order_status ?? "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Submitted</p>
                    <p className="mt-1 text-text-secondary">
                      {new Date(payment.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {proof ? (
                  <div className="mt-5 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                    <p className="text-xs text-text-muted">Latest proof</p>
                    <p className="mt-1 text-sm text-text-primary">
                      {proof.original_filename ?? "Payment proof"} · {formatFileSize(proof.file_size_bytes)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Verification: {proof.verification_status}
                    </p>
                    {proofUrl ? (
                      <a
                        href={proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="probee-focus-ring mt-3 inline-flex min-h-10 items-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-background px-3 text-xs font-semibold text-text-primary hover:border-[var(--probee-border-strong)]"
                      >
                        View proof securely
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[var(--probee-radius-md)] border border-dashed border-[var(--probee-border-default)] p-4 text-sm text-text-muted">
                    No payment proof is attached.
                  </div>
                )}

                {payment.payment_status === "pending" ? (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <form action={markManualPaymentPaidAction}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <button
                        type="submit"
                        className="probee-focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover sm:w-auto"
                      >
                        Mark as paid
                      </button>
                    </form>
                    <form action={rejectManualPaymentAction}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <button
                        type="submit"
                        className="probee-focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] border border-red-300/20 bg-red-300/5 px-4 text-sm font-semibold text-red-100 hover:bg-red-300/10 sm:w-auto"
                      >
                        Reject payment
                      </button>
                    </form>
                  </div>
                ) : null}
              </Surface>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
