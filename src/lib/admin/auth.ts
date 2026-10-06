import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface StaffContext {
  user: User;
}

export async function getStaffContext(): Promise<StaffContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: isStaff, error } = await supabase.rpc(
    "current_user_is_staff",
  );

  if (error || !isStaff) {
    return null;
  }

  return { user };
}

export async function requireStaff(): Promise<StaffContext> {
  const context = await getStaffContext();

  if (!context) {
    redirect("/");
  }

  return context;
}
