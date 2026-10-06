import type { ReactNode } from "react";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { CartProvider } from "@/lib/cart/provider";
import { getCurrentUser } from "@/lib/auth/server";
import { hasSupabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = hasSupabasePublicEnv() ? await getCurrentUser() : null;

  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <SiteHeader
          accountEmail={user?.email ?? null}
          emailVerified={Boolean(user?.email_confirmed_at)}
        />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
