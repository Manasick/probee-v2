"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, LoadingState } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import {
  getBrowserAuthRedirect,
  getSafeNextPath,
} from "@/lib/auth/redirect";
import {
  isValidEmail,
  normalizeEmail,
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/auth/validation";

function fieldClassName() {
  return "min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]";
}

function fieldLabel() {
  return "mb-2 block text-sm font-medium text-text-secondary";
}

function ErrorText({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm leading-6 text-red-100" role="alert">
      {message}
    </p>
  );
}

function SuccessText({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-[var(--probee-border-default)] bg-gold-soft px-3 py-2.5 text-sm leading-6 text-gold" role="status">
      {message}
    </p>
  );
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setPending(true);

    const supabase = createClient();
    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (signInError) {
      setPending(false);
      setError(
        "Unable to sign in. Check your email and password, and confirm your email address if activation is required.",
      );
      return;
    }

    const { data: isStaff } = await supabase.rpc("current_user_is_staff");
    const safeNext = getSafeNextPath(nextPath, "/account");

    router.replace(isStaff ? "/admin" : safeNext);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {error ? <ErrorText message={error} /> : null}

      <div>
        <label htmlFor="login-email" className={fieldLabel()}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClassName()}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="login-password" className={fieldLabel()}>
            Password
          </label>
          <Link
            href="/forgot-password"
            className="probee-focus-ring rounded text-xs font-medium text-gold hover:text-gold-hover"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClassName()}
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <LoadingState label="Signing in" /> : "Sign in"}
      </Button>

      <p className="text-center text-sm text-text-muted">
        New to ProBee?{" "}
        <Link
          href={
            nextPath
              ? "/signup?next=" + encodeURIComponent(nextPath)
              : "/signup"
          }
          className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function ResendConfirmationForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }

    setPending(true);
    const supabase = createClient();

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: getBrowserAuthRedirect("/account"),
      },
    });

    setPending(false);

    if (error) {
      setMessage(
        "If a confirmation can be sent for that address, the request has been received. Please check your inbox or try again later.",
      );
      return;
    }

    setMessage(
      "If a confirmation can be sent for that address, the request has been received. Please check your inbox.",
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <label htmlFor="resend-email" className="sr-only">
        Email for confirmation
      </label>
      <input
        id="resend-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={fieldClassName()}
        placeholder="you@example.com"
      />
      <Button type="submit" size="md" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Resend confirmation"}
      </Button>
      {message ? <SuccessText message={message} /> : null}
    </form>
  );
}

export function SignupForm({
  nextPath,
}: {
  nextPath: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    const confirmationError = validatePasswordConfirmation(
      password,
      confirmation,
    );

    if (confirmationError) {
      setError(confirmationError);
      return;
    }

    setPending(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getBrowserAuthRedirect("/account"),
      },
    });

    if (signUpError) {
      setPending(false);
      setError(
        "We couldn't complete registration. Check the details and try again.",
      );
      return;
    }

    if (data.user && data.session) {
      await supabase
        .from("profiles")
        .upsert({ id: data.user.id });

      const { data: isStaff } = await supabase.rpc("current_user_is_staff");
      const safeNext = getSafeNextPath(nextPath, "/account");
      router.replace(isStaff ? "/admin" : safeNext);
      router.refresh();
      return;
    }

    setRegisteredEmail(normalizedEmail);
    setNeedsConfirmation(true);
    setPending(false);
  }

  if (needsConfirmation) {
    return (
      <div className="grid gap-5">
        <SuccessText message="Your account has been created. Check your email to activate it before signing in." />

        <div className="rounded-lg border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
          <p className="text-sm leading-6 text-text-secondary">
            Confirmation is handled by Supabase Auth. ProBee does not store
            passwords or verification tokens.
          </p>
        </div>

        <ResendConfirmationForm initialEmail={registeredEmail} />

        <p className="text-center text-sm text-text-muted">
          After activation,{" "}
          <Link
            href={
              nextPath
                ? "/login?next=" + encodeURIComponent(nextPath)
                : "/login"
            }
            className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
          >
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {error ? <ErrorText message={error} /> : null}

      <div>
        <label htmlFor="signup-email" className={fieldLabel()}>
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClassName()}
        />
      </div>

      <div>
        <label htmlFor="signup-password" className={fieldLabel()}>
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClassName()}
        />
        <p className="mt-2 text-xs leading-5 text-text-muted">
          Use at least 8 characters.
        </p>
      </div>

      <div>
        <label htmlFor="signup-confirm-password" className={fieldLabel()}>
          Confirm password
        </label>
        <input
          id="signup-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={fieldClassName()}
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <LoadingState label="Creating account" /> : "Create account"}
      </Button>

      <p className="text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link
          href={
            nextPath
              ? "/login?next=" + encodeURIComponent(nextPath)
              : "/login"
          }
          className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setPending(true);
    const supabase = createClient();

    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getBrowserAuthRedirect("/reset-password"),
    });

    setPending(false);
    setSent(true);
  }

  return sent ? (
    <div className="grid gap-5">
      <SuccessText message="If a password reset can be sent for that address, the instructions are on the way. Please check your inbox and spam folder." />
      <Link
        href="/login"
        className="probee-focus-ring inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold hover:bg-surface-3"
      >
        Return to sign in
      </Link>
    </div>
  ) : (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {error ? <ErrorText message={error} /> : null}

      <div>
        <label htmlFor="forgot-email" className={fieldLabel()}>
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClassName()}
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <LoadingState label="Requesting reset" /> : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-text-muted">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const passwordError = validatePassword(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    const confirmationError = validatePasswordConfirmation(
      password,
      confirmation,
    );

    if (confirmationError) {
      setError(confirmationError);
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setPending(false);

    if (updateError) {
      setError(
        "We couldn't update your password. Please restart the recovery flow and try again.",
      );
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="grid gap-5">
        <SuccessText message="Your password has been updated successfully." />
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => {
            router.replace("/account");
            router.refresh();
          }}
        >
          Continue to account
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {error ? <ErrorText message={error} /> : null}

      <div>
        <label htmlFor="reset-password" className={fieldLabel()}>
          New password
        </label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClassName()}
        />
      </div>

      <div>
        <label htmlFor="reset-confirm-password" className={fieldLabel()}>
          Confirm new password
        </label>
        <input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={fieldClassName()}
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <LoadingState label="Updating password" /> : "Set new password"}
      </Button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="md"
      variant="secondary"
      disabled={pending}
      onClick={() => void signOut()}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
