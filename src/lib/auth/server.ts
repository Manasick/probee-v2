import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AccountProfile {
  id: string;
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function getCurrentUserOrRedirect(
  next = "/account",
): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=" + encodeURIComponent(next));
  }

  return user;
}

export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,phone,avatar_url,created_at,updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (data) {
    return {
      id: data.id,
      displayName: data.display_name,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select("id,display_name,phone,avatar_url,created_at,updated_at")
    .single();

  if (insertError || !inserted) {
    return null;
  }

  return {
    id: inserted.id,
    displayName: inserted.display_name,
    phone: inserted.phone,
    avatarUrl: inserted.avatar_url,
    createdAt: inserted.created_at,
    updatedAt: inserted.updated_at,
  };
}
