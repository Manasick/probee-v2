import { AuthForm, ResendVerificationForm } from "@/components/auth/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const registered = params.registered === "1";
  const verified = params.verified === "1";
  const error = params.error === "verification_failed" || params.error === "invalid_callback";

  const initialMessage = registered
    ? "Your account was created. Check your email and follow the ProBee activation link before signing in."
    : verified
      ? "Your email is activated. You can now sign in."
      : error
        ? "The activation link could not be completed. Please request a new activation email."
        : "";

  return (
    <>
      <div className="mb-8">
        <p className="probee-label">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Sign in to ProBee
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Use the customer account created through ProBee authentication.
        </p>
      </div>

      <AuthForm
        mode="login"
        next={typeof nextValue === "string" ? nextValue : "/account"}
        initialMessage={initialMessage}
      />

      {(registered || error) ? (
        <ResendVerificationForm />
      ) : (
        <div className="mt-5">
          <ResendVerificationForm />
        </div>
      )}
    </>
  );
}
