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
    <div className="min-h-screen bg-background text-text-primary">
      <div className="border-b border-[var(--probee-border-subtle)] bg-surface-1 lg:hidden">
        <div className="probee-container">
          <details>
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-2 focus-visible:outline-gold">
              <BrandMark />
              <span className="text-sm text-text-muted">Admin menu</span>
            </summary>
            <div className="border-t border-[var(--probee-border-subtle)] py-2">
              <nav className="grid gap-1" aria-label="Admin navigation">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="probee-focus-ring flex min-h-12 items-center rounded-lg px-3 text-sm font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-2 border-t border-[var(--probee-border-subtle)] pt-2">
                <p className="px-3 py-2 text-xs text-text-muted">{userEmail}</p>
                <form action={signOutAdminAction}>
                  <button
                    type="submit"
                    className="probee-focus-ring flex min-h-12 w-full items-center rounded-lg px-3 text-sm font-semibold text-red-200 hover:bg-red-400/10"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="mx-auto grid min-h-screen max-w-[100rem] lg:grid-cols-[15rem_1fr]">
        <aside className="hidden border-r border-[var(--probee-border-subtle)] bg-surface-1 lg:block">
          <div className="sticky top-0 flex min-h-screen flex-col p-5">
            <Link href="/admin" className="probee-focus-ring inline-flex rounded-lg">
              <BrandMark />
            </Link>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-text-muted">
              Admin workspace
            </p>

            <nav className="mt-8 grid gap-1" aria-label="Admin navigation">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="probee-focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto border-t border-[var(--probee-border-subtle)] pt-4">
              <p className="truncate text-xs text-text-muted" title={userEmail}>
                {userEmail}
              </p>
              <p className="mt-1 text-[0.6875rem] uppercase tracking-[0.1em] text-gold">
                {isAdmin ? "Administrator" : "Staff manager"}
              </p>
              <form action={signOutAdminAction} className="mt-3">
                <button
                  type="submit"
                  className="probee-focus-ring flex min-h-10 w-full items-center justify-center rounded-lg border border-red-300/20 bg-red-300/5 px-3 text-xs font-semibold text-red-100 hover:bg-red-300/10"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-[var(--probee-border-subtle)] bg-background/90 backdrop-blur-xl">
            <div className="probee-container flex min-h-16 items-center justify-between gap-4">
              <div>
                <p className="probee-label">ProBee Admin</p>
                <p className="mt-1 text-sm text-text-muted">
                  Secure operations workspace
                </p>
              </div>
              <Link
                href="/"
                className="probee-focus-ring rounded-md text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                View storefront
              </Link>
            </div>
          </header>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
