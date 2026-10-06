import { redirect } from "next/navigation";
import { ResendVerificationForm } from "@/components/auth/auth-form";
import { Button, Container, Surface } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile, getCurrentUser } from "@/lib/auth/server";
import { signOutAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=%2Faccount");
  }

  const supabase = await createClient();
  const profile = await ensureProfile(supabase, user.id);

  const verified = Boolean(user.email_confirmed_at);
  const passwordUpdated = params.password === "updated";
  const email = user.email ?? "Unknown";

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-3xl">
          <p className="probee-label">Customer account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Your ProBee account
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Your account area is ready for future orders, tracking and digital
            access modules. Those features are intentionally not enabled in STEP 9.
          </p>
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
          <Surface className="mt-8 border-red-400/30 bg-red-400/5" role="status">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-100">
                  Email activation required
                </p>
                <p className="mt-2 text-sm leading-6 text-red-200/80">
                  This account is authenticated, but the email address has not
                  been confirmed yet. Use the activation email before treating
                  the account as fully active.
                </p>
              </div>
              <span className="inline-flex min-h-7 items-center rounded-full border border-red-400/30 bg-red-400/10 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-red-200">
                Not verified
              </span>
            </div>

            <div className="mt-4 grid gap-4">
              <ResendVerificationForm initialEmail={email} />
              <form action={signOutAction}>
                <Button type="submit" size="sm" variant="secondary">
                  Sign out
                </Button>
              </form>
            </div>
          </Surface>
        ) : (
          <Surface className="mt-8 border-[var(--probee-border-default)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Email activated</p>
                <p className="mt-1 text-sm text-text-muted">
                  Your email address is confirmed for this account.
                </p>
              </div>
              <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--probee-border-default)] bg-gold-soft px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-gold">
                Verified
              </span>
            </div>
          </Surface>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Surface className="p-6">
            <p className="probee-label">Account identity</p>
            <h2 className="mt-2 text-xl font-semibold">{email}</h2>

            <dl className="mt-6 grid gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                  Account status
                </dt>
                <dd className="mt-1 text-text-secondary">
                  {verified ? "Email verified" : "Activation required"}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                  Profile name
                </dt>
                <dd className="mt-1 text-text-secondary">
                  {profile?.displayName || "Not set"}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-text-muted">
                  Phone
                </dt>
                <dd className="mt-1 text-text-secondary">
                  {profile?.phone || "Not set"}
                </dd>
              </div>
            </dl>
          </Surface>

          <Surface className="p-6">
            <p className="probee-label">Future account areas</p>
            <h2 className="mt-2 text-xl font-semibold">
              Prepared, not activated
            </h2>

            <div className="mt-5 grid gap-3">
              {["Orders", "Order tracking", "Digital products", "Account settings"].map(
                (item) => (
                  <div
                    key={item}
                    className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 px-4 py-3 text-sm text-text-muted"
                  >
                    {item} — coming in a later step
                  </div>
                ),
              )}
            </div>
          </Surface>
        </div>

        <Surface className="mt-6 p-6">
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
