import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface AuthenticatedProfile {
  id: string;
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedContext {
  user: User;
  profile: AuthenticatedProfile;
  isStaff: boolean;
}

export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name,phone,avatar_url,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return null;
  }

  if (!profile) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id });

    if (insertError) {
      return null;
    }

    const result = await supabase
      .from("profiles")
      .select("id,display_name,phone,avatar_url,created_at,updated_at")
      .eq("id", user.id)
      .single();

    if (result.error) {
      return null;
    }

    profile = result.data;
  }

  const { data: isStaff } = await supabase.rpc("current_user_is_staff");

  return {
    user,
    profile: {
      id: profile.id,
      displayName: profile.display_name,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
    isStaff: Boolean(isStaff),
  };
}

export async function requireAuthenticated(
  nextPath = "/account",
): Promise<AuthenticatedContext> {
  const context = await getAuthenticatedContext();

  if (!context) {
    redirect("/login?next=" + encodeURIComponent(nextPath));
  }

  return context;
}
