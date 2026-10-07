"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { adminSignInAction } from "@/app/auth/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminSignInAction, INITIAL_AUTH_STATE);

  return (
    <form action={action} className="grid gap-5">
      {state.message ? <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100" role="alert">{state.message}</div> : null}
      <div>
        <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-text-secondary">Staff email</label>
        <input id="admin-email" name="email" type="email" autoComplete="username" required className="min-h-12 w-full rounded-xl border border-[var(--probee-border-default)] bg-surface-2 px-4 text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]" />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-text-secondary">Password</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="min-h-12 w-full rounded-xl border border-[var(--probee-border-default)] bg-surface-2 px-4 text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]" />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Opening console…" : "Enter admin console"}</Button>
    </form>
  );
}
