import { Container, Surface } from "@/components/ui";
import { AdminStatus } from "@/components/admin/admin-status";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { saveManualBankTransferSettingsAction } from "../payments/actions";

export const dynamic = "force-dynamic";

function value(input: string | string[] | undefined): string {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: isAdmin, error: roleError } = await supabase.rpc("current_user_is_admin");

  if (roleError || !isAdmin) {
    return (
      <section className="probee-section">
        <Container>
          <p className="probee-label">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Administration settings</h1>
          <Surface className="mt-8 border-amber-300/20 bg-amber-300/5 p-6" role="alert">
            <AdminStatus label="Admin only" tone="warning" />
            <p className="mt-4 text-sm leading-6 text-text-muted">
              Your staff account can operate the dashboard, but payment configuration is restricted to active administrator accounts.
            </p>
          </Surface>
        </Container>
      </section>
    );
  }

  const [{ data: settings, error }] = await Promise.all([
    supabase
      .from("payment_settings")
      .select("payment_method,enabled,bank_name,account_name,account_number,branch,bank_code_swift,payment_instructions")
      .eq("payment_method", "manual_bank_transfer")
      .maybeSingle(),
  ]);

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Administration settings</h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Configure the existing manual bank-transfer customer payment flow. No new payment gateway is introduced here.
          </p>
        </div>

        {value(params.success) ? <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4"><p className="text-sm text-emerald-100">{value(params.success)}</p></Surface> : null}
        {value(params.error) ? <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4" role="alert"><p className="text-sm text-red-100">{value(params.error)}</p></Surface> : null}

        {error ? (
          <Surface className="mt-8 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="font-semibold text-red-100">Settings could not be loaded.</p>
            <p className="mt-2 text-sm text-red-100/70">Refresh the page and try again.</p>
          </Surface>
        ) : (
          <Surface className="mt-8 p-5 sm:p-8">
            <div>
              <p className="probee-label">Manual bank transfer</p>
              <h2 className="mt-2 text-xl font-semibold">Customer payment configuration</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                The customer-facing flow reads only the existing active payment-setting columns through the established RLS policy.
              </p>
            </div>

            <form action={saveManualBankTransferSettingsAction} className="mt-6 grid gap-5">
              <input type="hidden" name="returnTo" value="/admin/settings" />
              <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-4">
                <span>
                  <span className="block text-sm font-semibold">Manual bank transfer enabled</span>
                  <span className="block text-xs text-text-muted">Allow customers to submit payment references and proofs.</span>
                </span>
                <input type="checkbox" name="enabled" defaultChecked={Boolean(settings?.enabled)} className="size-5 accent-[var(--probee-gold)]" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["bankName", "Bank name", settings?.bank_name ?? ""],
                  ["accountName", "Account name", settings?.account_name ?? ""],
                  ["accountNumber", "Account number", settings?.account_number ?? ""],
                  ["branch", "Branch", settings?.branch ?? ""],
                  ["bankCodeSwift", "Bank code / SWIFT", settings?.bank_code_swift ?? ""],
                ].map(([name, label, defaultValue]) => (
                  <label key={name} className="grid gap-2 text-sm font-medium text-text-secondary sm:last:col-span-2">
                    {label}
                    <input name={name} defaultValue={defaultValue} maxLength={120} className="min-h-11 rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary" />
                  </label>
                ))}
              </div>

              <label className="grid gap-2 text-sm font-medium text-text-secondary">
                Payment instructions
                <textarea name="paymentInstructions" defaultValue={settings?.payment_instructions ?? ""} maxLength={5000} rows={7} className="rounded-lg border border-[var(--probee-border-default)] bg-surface-2 px-3.5 py-3 text-sm leading-6 text-text-primary" />
              </label>

              <button type="submit" className="probee-focus-ring min-h-11 w-full rounded-lg bg-gold px-5 text-sm font-semibold text-text-inverse sm:w-fit">
                Save payment settings
              </button>
            </form>

            <div className="mt-6 border-t border-[var(--probee-border-subtle)] pt-5 text-xs leading-5 text-text-muted">
              These fields are the existing ProBee payment settings. They are not customer credentials and are not exposed through public anonymous queries.
            </div>
          </Surface>
        )}
      </Container>
    </section>
  );
}
