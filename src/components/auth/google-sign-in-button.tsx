"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton({ next = "/account" }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setPending(true);
    setError("");
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (oauthError) {
      setError("Google sign-in is not available right now. Please use email and password.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <button type="button" onClick={handleSignIn} disabled={pending} className="probee-google-auth probee-focus-ring inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-primary transition-all hover:border-[var(--probee-gold-border)] hover:bg-surface-3 disabled:opacity-60">
        <span className="grid size-6 place-items-center rounded-full bg-white text-[13px] font-bold text-[#4285F4]">G</span>
        {pending ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {error ? <p className="text-center text-xs leading-5 text-red-200" role="alert">{error}</p> : null}
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-text-muted"><span className="h-px flex-1 bg-[var(--probee-border-subtle)]" /><span>or email</span><span className="h-px flex-1 bg-[var(--probee-border-subtle)]" /></div>
    </div>
  );
}
