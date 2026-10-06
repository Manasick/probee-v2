"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAdminAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?next=%2Fadmin");
}
