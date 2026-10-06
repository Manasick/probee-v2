import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <>
      <div className="mb-8">
        <p className="probee-label">Customer account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Create your ProBee account
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Your password is handled by Supabase Auth. ProBee never stores your
          password in the application database.
        </p>
      </div>

      <AuthForm mode="signup" next={typeof next === "string" ? next : "/account"} />

      <p className="mt-6 text-xs leading-5 text-text-muted">
        By creating an account, you are starting an account-activation flow.
        ProBee will not treat an unverified email address as fully activated.
      </p>

      <Link
        href="/products"
        className="probee-focus-ring mt-5 inline-flex rounded text-xs font-semibold text-text-muted hover:text-text-primary"
      >
        Continue browsing without an account
      </Link>
    </>
  );
}
