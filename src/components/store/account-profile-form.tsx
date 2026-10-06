"use client";

import { useActionState } from "react";
import { Button, Input, Surface } from "@/components/ui";
import {
  INITIAL_PROFILE_STATE,
  updateProfileAction,
} from "@/app/(store)/account/actions";

interface AccountProfileFormProps {
  displayName: string | null;
  phone: string | null;
}

export function AccountProfileForm({
  displayName,
  phone,
}: AccountProfileFormProps) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    INITIAL_PROFILE_STATE,
  );

  return (
    <Surface id="profile" className="scroll-mt-24 p-6 sm:p-8">
      <div>
        <p className="probee-label">Profile</p>
        <h2 className="mt-2 text-xl font-semibold">Your profile details</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Keep your customer profile up to date. Your account email is managed
          by Supabase Auth and is not edited here.
        </p>
      </div>

      <form action={action} className="mt-6 grid gap-5">
        <Input
          name="displayName"
          label="Display name"
          defaultValue={displayName ?? ""}
          maxLength={120}
          autoComplete="name"
          placeholder="Your name"
        />

        <Input
          name="phone"
          label="Phone"
          defaultValue={phone ?? ""}
          maxLength={50}
          autoComplete="tel"
          inputMode="tel"
          placeholder="Optional"
        />

        {state.message ? (
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
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Surface>
  );
}
