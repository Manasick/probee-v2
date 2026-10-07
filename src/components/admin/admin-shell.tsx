import Link from "next/link";
import { BrandMark } from "@/components/ui";
import { signOutAdminAction } from "@/app/admin/actions";

const baseNavigation = [
  { label: "Dashboard", href: "/admin" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Digital Delivery", href: "/admin/digital-delivery" },
  { label: "Email Activity", href: "/admin/email-activity" },
] as const;

export function AdminShell({
  children,
  userEmail,
  isAdmin,
}: Readonly<{
  children: React.ReactNode;
  userEmail: string;
  isAdmin: boolean;
}>) {
  const navigation = isAdmin
    ? [...baseNavigation, { label: "Settings", href: "/admin/settings" }]
    : baseNavigation;

  return (
    <div className="probee-admin-shell min-h-screen bg-background text-text-primary">
      <div className="border-b border-[var(--probee-border-subtle)] bg-[#070707]/90 backdrop-blur-2xl lg:hidden">
        <div className="probee-container">
          <details>
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-2 focus-visible:outline-gold">
              <BrandMark />
              <span className="probee-admin-menu-label">Operations menu</span>
            </summary>
            <div className="probee-admin-mobile-menu">
              <nav className="grid gap-1" aria-label="Admin navigation">
                {navigation.map((item) => (
                  <Link key={item.href} href={item.href} className="probee-focus-ring probee-admin-nav-link">
                    <span>{item.label}</span><span aria-hidden="true">›</span>
                  </Link>
                ))}
              </nav>
              <div className="probee-admin-mobile-user">
                <p>{userEmail}</p>
                <form action={signOutAdminAction}>
                  <button type="submit" className="probee-focus-ring probee-admin-signout">Sign out</button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="mx-auto grid min-h-screen max-w-[100rem] lg:grid-cols-[16rem_1fr]">
        <aside className="probee-admin-sidebar hidden lg:block">
          <div className="sticky top-0 flex min-h-screen flex-col p-5">
            <Link href="/admin" className="probee-focus-ring inline-flex rounded-xl">
              <BrandMark />
            </Link>
            <div className="probee-admin-workspace">
              <span className="probee-admin-live-dot" aria-hidden="true" />
              <span>Live workspace</span>
            </div>

            <nav className="mt-7 grid gap-1" aria-label="Admin navigation">
              {navigation.map((item) => (
                <Link key={item.href} href={item.href} className="probee-focus-ring probee-admin-nav-link">
                  <span>{item.label}</span><span aria-hidden="true">›</span>
                </Link>
              ))}
            </nav>

            <div className="probee-admin-user-card mt-auto">
              <div className="probee-admin-user-avatar" aria-hidden="true">{userEmail.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0">
                <p className="truncate text-xs text-text-secondary" title={userEmail}>{userEmail}</p>
                <p className="mt-1 text-[0.625rem] uppercase tracking-[0.14em] text-gold">
                  {isAdmin ? "Administrator" : "Staff manager"}
                </p>
              </div>
              <form action={signOutAdminAction} className="col-span-2">
                <button type="submit" className="probee-focus-ring probee-admin-signout">Sign out</button>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="probee-admin-topbar">
            <div className="probee-container flex min-h-[4.5rem] items-center justify-between gap-4">
              <div>
                <p className="probee-label">ProBee Admin</p>
                <p className="mt-1 text-xs text-text-muted sm:text-sm">Secure operations command center</p>
              </div>
              <Link href="/" className="probee-focus-ring probee-admin-store-link">
                <span className="hidden sm:inline">View storefront</span>
                <span className="sm:hidden">Storefront</span>
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </header>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
