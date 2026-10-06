import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("current_user_is_admin");

  return (
    <AdminShell
      userEmail={staff.user.email ?? "Staff account"}
      isAdmin={Boolean(isAdmin)}
    >
      {children}
    </AdminShell>
  );
}
