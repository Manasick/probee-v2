import Link from "next/link";
import { redirect } from "next/navigation";
import { ResendVerificationForm } from "@/components/auth/auth-form";
import { Button, Container, Surface } from "@/components/ui";
import { AccountNav } from "@/components/store/account-nav";
import { AccountProfileForm } from "@/components/store/account-profile-form";
import { StatusBadge } from "@/components/store/status-badge";
import { requireAuthenticated } from "@/lib/auth/server";
import { formatCurrency, formatDate } from "@/lib/orders/presentation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

interface RecentOrder {
  id: string;
  order_reference: string;
  order_status: string;
  payment_status: string;
  total: number | string;
  currency: string;
  created_at: string;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAuthenticated("/account");
  const params = await searchParams;
  const passwordUpdated = params.password === "updated";
  const supabase = await createClient();

  const [
    totalOrdersResult,
    activeOrdersResult,
    completedOrdersResult,
    recentOrdersResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id)
      .in("order_status", ["pending", "processing"]),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id)
      .eq("order_status", "completed"),
    supabase
      .from("orders")
      .select(
        "id,order_reference,order_status,payment_status,total,currency,created_at",
      )
      .eq("user_id", context.user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentOrders = (recentOrdersResult.data ?? []) as RecentOrder[];
  const orderSummaryError =
    totalOrdersResult.error ||
    activeOrdersResult.error ||
    completedOrdersResult.error ||
    recentOrdersResult.error;

  if (!context.profile) {
    redirect("/account");
  }

  const verified = Boolean(context.user.email_confirmed_at);
  const email = context.user.email ?? "Unknown";

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Customer account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Welcome to your ProBee account
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Manage your profile, review your orders, and track payment progress
            from one secure customer area.
          </p>
        </div>

        <div className="mt-8">
          <AccountNav />
        </div>

        {passwordUpdated ? (
          <Surface className="mt-8 border-[var(--probee-border-default)]" role="status">
            <p className="text-sm font-semibold text-gold">
              Your password was updated successfully.
            </p>
            <p className="mt-1 text-sm text-text-muted">
              You are signed in with the new password.
            </p>
          </Surface>
        ) : null}

        {!verified ? (
          <Surface className="mt-6 border-red-400/30 bg-red-400/5" role="status">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-100">
                  Email activation required
                </p>
                <p className="mt-2 text-sm leading-6 text-red-200/80">
                  Your session is authenticated, but the account email is not
                  confirmed yet. Use the existing activation flow to fully
                  activate the account.
                </p>
              </div>
              <span className="inline-flex min-h-7 items-center rounded-full border border-red-400/30 bg-red-400/10 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-red-200">
                Not verified
              </span>
            </div>

            <div className="mt-4">
              <ResendVerificationForm initialEmail={email} />
            </div>
          </Surface>
        ) : (
          <Surface className="mt-6 border-[var(--probee-border-default)]" role="status">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Email verified</p>
                <p className="mt-1 text-sm text-text-muted">
                  Your Supabase Auth account is activated.
                </p>
              </div>
              <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--probee-border-default)] bg-gold-soft px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-gold">
                Verified
              </span>
            </div>
          </Surface>
        )}

        <div id="overview" className="mt-6 grid scroll-mt-24 gap-4 sm:grid-cols-3">
          {[
            ["Total orders", totalOrdersResult.count ?? 0],
            ["Current orders", activeOrdersResult.count ?? 0],
            ["Completed", completedOrdersResult.count ?? 0],
          ].map(([label, value]) => (
            <Surface key={label as string} className="p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">
                {value}
              </p>
            </Surface>
          ))}
        </div>

        {orderSummaryError ? (
          <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="text-sm font-semibold text-red-100">
              Order summary is temporarily unavailable.
            </p>
            <p className="mt-2 text-sm leading-6 text-red-100/70">
              Your profile remains available, but order information could not be loaded right now.
            </p>
          </Surface>
        ) : (
          <Surface className="mt-6 p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="probee-label">Recent orders</p>
                <h2 className="mt-2 text-xl font-semibold">Your latest activity</h2>
              </div>
              <Link
                href="/account/orders"
                className="probee-focus-ring rounded text-sm font-semibold text-gold hover:text-gold-hover"
              >
                View all orders
              </Link>
            </div>

            {recentOrders.length > 0 ? (
              <div className="mt-6 grid gap-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          href={"/account/orders/" + encodeURIComponent(order.order_reference)}
                          className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
                        >
                          {order.order_reference}
                        </Link>
                        <p className="mt-1 text-xs text-text-muted">
                          {formatDate(order.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StatusBadge kind="order" status={order.order_status} />
                        <StatusBadge kind="payment" status={order.payment_status} />
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-sm font-semibold text-text-primary">
                          {formatCurrency(order.total, order.currency)}
                        </p>
                        <Link
                          href={"/account/orders/" + encodeURIComponent(order.order_reference)}
                          className="probee-focus-ring mt-1 inline-flex rounded text-xs font-semibold text-text-muted hover:text-text-primary"
                        >
                          View details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-5">
                <p className="text-sm font-semibold">No orders yet</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Your ProBee purchases will appear here after checkout.
                </p>
                <Link
                  href="/products"
                  className="probee-focus-ring mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                >
                  Browse products
                </Link>
              </div>
            )}
          </Surface>
        )}

        <AccountProfileForm
          displayName={context.profile.displayName}
          phone={context.profile.phone}
        />

        <Surface id="security" className="mt-6 scroll-mt-24 p-6 sm:p-8">
          <p className="probee-label">Security</p>
          <h2 className="mt-2 text-xl font-semibold">Account security</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
                Account email
              </p>
              <p className="mt-2 break-words text-sm font-medium text-text-primary">
                {email}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Email changes are handled by Supabase Auth.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold">Password</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Password changes continue through the existing Supabase Auth
                recovery flow.
              </p>
              <Link
                href="/forgot-password"
                className="probee-focus-ring mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary hover:bg-surface-3"
              >
                Password recovery
              </Link>
            </div>
          </div>
        </Surface>

        <Surface className="mt-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Session</p>
              <p className="mt-1 text-sm text-text-muted">
                Sign out to clear the current authenticated browser session.
              </p>
            </div>

            <form action={signOutAction}>
              <Button type="submit" size="lg" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </Surface>
      </Container>
    </section>
  );
}
