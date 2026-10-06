import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const callbackError = params.error === "invalid";

  return (
    <>
      <div className="mb-8">
        <p className="probee-label">Account recovery</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          This page is available only after Supabase Auth creates a valid
          recovery session.
        </p>
      </div>

      {callbackError ? (
        <div
          className="mb-5 rounded-[var(--probee-radius-md)] border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100"
          role="alert"
        >
          The password-reset link could not be verified. Request a new one.
        </div>
      ) : null}

      {user ? (
        <AuthForm mode="reset" />
      ) : (
        <div className="grid gap-4">
          <div className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 py-4 text-sm leading-6 text-text-secondary">
            Your recovery session is missing or expired.
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-12 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-5 text-sm font-semibold text-text-inverse probee-focus-ring hover:bg-gold-hover"
          >
            Request a new reset email
          </Link>
        </div>
      )}
    </>
  );
}
