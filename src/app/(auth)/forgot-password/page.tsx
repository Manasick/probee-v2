import { AuthForm } from "@/components/auth/auth-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-8">
        <p className="probee-label">Account recovery</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Enter your email. For privacy, ProBee uses the same public response
          whether or not an account can receive recovery mail.
        </p>
      </div>

      <AuthForm mode="forgot" />
    </>
  );
}
