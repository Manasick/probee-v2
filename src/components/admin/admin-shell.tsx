import Link from "next/link";
import { BrandMark } from "@/components/ui";

const navigation = [
  { label: "Dashboard", href: "/admin", live: false },
  { label: "Products", href: "/admin/products", live: true },
  { label: "Categories", href: "/admin/categories", live: false },
  { label: "Orders", href: "/admin/orders", live: false },
  { label: "Customers", href: "/admin/customers", live: false },
  { label: "Digital delivery", href: "/admin/digital-delivery", live: true },
  { label: "Payments", href: "/admin/payments", live: true },
  { label: "Settings", href: "/admin/settings", live: false },
] as const;

export function AdminShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="border-b border-[var(--probee-border-subtle)] bg-surface-1 lg:hidden">
        <div className="probee-container">
          <details>
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-2 focus-visible:outline-gold">
              <BrandMark />
              <span className="text-sm text-text-muted">Admin menu</span>
            </summary>
            <nav className="border-t border-[var(--probee-border-subtle)] py-2" aria-label="Admin navigation">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="probee-focus-ring flex min-h-12 items-center justify-between rounded-lg px-3 text-sm font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                >
                  <span>{item.label}</span>
                  {item.live ? (
                    <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-gold">
                      Live
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Soon</span>
                  )}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>

      <div className="mx-auto grid min-h-screen max-w-[100rem] lg:grid-cols-[15rem_1fr]">
        <aside className="hidden border-r border-[var(--probee-border-subtle)] bg-surface-1 lg:block">
          <div className="sticky top-0 p-5">
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
                  className="probee-focus-ring flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                >
                  <span>{item.label}</span>
                  {item.live ? (
                    <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-gold">
                      Live
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] text-text-muted">Soon</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="hidden border-b border-[var(--probee-border-subtle)] bg-background/90 backdrop-blur-xl lg:block">
            <div className="probee-container flex min-h-16 items-center justify-between">
              <div>
                <p className="probee-label">ProBee</p>
                <p className="mt-1 text-sm text-text-muted">Catalog administration</p>
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
