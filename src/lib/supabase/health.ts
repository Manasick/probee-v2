import { createClient } from "./server";

export interface SupabaseHealthResult {
  ok: boolean;
  status: "reachable" | "unreachable";
}

/**
 * Performs a safe Auth connectivity check without returning user data,
 * tokens, claims, or database contents.
 */
export async function checkSupabaseConnection(): Promise<SupabaseHealthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.getClaims();

  if (!error || error.name === "AuthSessionMissingError") {
    return {
      ok: true,
      status: "reachable",
    };
  }

  return {
    ok: false,
    status: "unreachable",
  };
}
