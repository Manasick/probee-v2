"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Surface } from "@/components/ui";
import {
  forgotPasswordAction,
  INITIAL_AUTH_STATE,
  resendVerificationAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/app/auth/actions";
import type { AuthActionState } from "@/app/auth/actions";

type AuthFormMode = "login" | "signup" | "forgot" | "reset";

interface AuthFormProps {
  mode: AuthFormMode;
  next?: string;
  initialMessage?: string;
}

function inputClassName() {
  return "min-h-12 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-4 text-base text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]";
}

function FormMessage({
  state,
}: {
  state: AuthActionState;
}) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={[
        "rounded-[var(--probee-radius-md)] border px-4 py-3 text-sm leading-6",
        state.ok
          ? "border-[var(--probee-border-default)] bg-gold-soft text-gold"
          : "border-red-400/30 bg-red-400/10 text-red-100",
      ].join(" ")}
      role={state.ok ? "status" : "alert"}
      aria-live="polite"
    >
      {state.message}
    </div>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  return (
    <Button type="submit" size="lg" className="w-full">
      {label}
      <span className="sr-only">{pendingLabel}</span>
    </Button>
  );
}

export function AuthForm({
  mode,
  next = "/account",
  initialMessage = "",
}: AuthFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(
    mode === "login"
      ? signInAction
      : mode === "signup"
        ? signUpAction
        : mode === "forgot"
          ? forgotPasswordAction
          : resetPasswordAction,
    {
      ...INITIAL_AUTH_STATE,
      message: initialMessage,
    },
  );

  if (mode === "login") {
    return (
      <form action={action} className="grid gap-5">
        {initialMessage ? <FormMessage state={state} /> : null}
        {state.message && !initialMessage ? <FormMessage state={state} /> : null}

        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-text-secondary">
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            className={inputClassName()}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="text-sm font-medium text-text-secondary">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="probee-focus-ring rounded text-xs font-semibold text-gold hover:text-gold-hover"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className={inputClassName() + " pr-24"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="probee-focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-2 text-xs font-semibold text-text-muted hover:text-text-primary"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {!state.ok && state.message ? <FormMessage state={state} /> : null}

        <SubmitButton
          label={pending ? "Signing in…" : "Sign in"}
          pendingLabel={pending ? "Please wait" : ""}
        />

        <div className="text-center text-sm text-text-muted">
          New to ProBee?{" "}
          <Link
            href={"/signup" + (next !== "/account" ? "?next=" + encodeURIComponent(next) : "")}
            className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
          >
            Create an account
          </Link>
        </div>
      </form>
    );
  }

  if (mode === "signup") {
    return (
      <form action={action} className="grid gap-5">
        {state.message ? <FormMessage state={state} /> : null}

        <div>
          <label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-text-secondary">
            Email
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            className={inputClassName()}
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="mb-2 block text-sm font-medium text-text-secondary">
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className={inputClassName()}
          />
          <p className="mt-2 text-xs leading-5 text-text-muted">
            Use at least 8 characters.
          </p>
        </div>

        <div>
          <label
            htmlFor="signup-confirm-password"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className={inputClassName()}
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
            className="mt-1 size-4 accent-[var(--probee-gold)]"
          />
          <span>Show passwords while I check them.</span>
        </label>

        <SubmitButton
          label={pending ? "Creating account…" : "Create account"}
          pendingLabel={pending ? "Please wait" : ""}
        />

        <p className="text-xs leading-5 text-text-muted">
          After registration, use the Supabase Auth email confirmation message
          to activate the account before treating it as fully active.
        </p>

        <div className="text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
          >
            Sign in
          </Link>
        </div>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form action={action} className="grid gap-5">
        {state.message ? <FormMessage state={state} /> : null}

        {!state.ok ? (
          <div>
            <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={inputClassName()}
            />
          </div>
        ) : null}

        {!state.ok ? (
          <SubmitButton
            label={pending ? "Sending instructions…" : "Send reset email"}
            pendingLabel={pending ? "Please wait" : ""}
          />
        ) : null}

        <div className="text-center text-sm text-text-muted">
          <Link
            href="/login"
            className="probee-focus-ring rounded font-semibold text-gold hover:text-gold-hover"
          >
            Back to sign in
          </Link>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="grid gap-5">
      {state.message ? <FormMessage state={state} /> : null}

      {!state.ok ? (
        <>
          <div>
            <label htmlFor="reset-password" className="mb-2 block text-sm font-medium text-text-secondary">
              New password
            </label>
            <input
              id="reset-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className={inputClassName()}
            />
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password"
              className="mb-2 block text-sm font-medium text-text-secondary"
            >
              Confirm new password
            </label>
            <input
              id="reset-confirm-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className={inputClassName()}
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
              className="mt-1 size-4 accent-[var(--probee-gold)]"
            />
            <span>Show passwords while I check them.</span>
          </label>

          <SubmitButton
            label={pending ? "Updating password…" : "Update password"}
            pendingLabel={pending ? "Please wait" : ""}
          />
        </>
      ) : (
        <Link
          href="/account"
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-5 text-sm font-semibold text-text-inverse probee-focus-ring hover:bg-gold-hover"
        >
          Continue to account
        </Link>
      )}
    </form>
  );
}

export function ResendVerificationForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const [state, action, pending] = useActionState(
    resendVerificationAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <Surface className="mt-5 p-5">
      <p className="text-sm font-semibold">Need another activation email?</p>
      <p className="mt-2 text-xs leading-5 text-text-muted">
        Enter the email you used for ProBee. The response is intentionally
        generic for account privacy.
      </p>

      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="resend-verification-email">
          Email
        </label>
        <input
          id="resend-verification-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={initialEmail}
          required
          placeholder="you@example.com"
          className={inputClassName()}
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Resend activation"}
        </Button>
      </form>

      {state.message ? (
        <div
          className="mt-4 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-gold-soft px-4 py-3 text-sm leading-6 text-gold"
          role="status"
          aria-live="polite"
        >
          {state.message}
        </div>
      ) : null}
    </Surface>
  );
}
