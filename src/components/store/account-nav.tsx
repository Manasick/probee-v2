"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Overview", href: "/account", match: (path: string) => path === "/account" },
  { label: "Orders", href: "/account/orders", match: (path: string) => path.startsWith("/account/orders") },
  { label: "Reviews", href: "/account/reviews", match: (path: string) => path.startsWith("/account/reviews") },
  { label: "Digital products", href: "/account/digital-products", match: (path: string) => path.startsWith("/account/digital-products") },
  { label: "Profile", href: "/account#profile", match: () => false },
  { label: "Security", href: "/account#security", match: () => false },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account navigation"
      className="probee-account-nav grid gap-2 sm:flex sm:flex-wrap"
    >
      {items.map((item) => {
        const active = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`probee-focus-ring rounded-[var(--probee-radius-md)] border px-4 py-3 text-sm font-semibold transition-colors ${
              active
                ? "probee-account-nav-active border-[var(--probee-gold-border)] bg-[var(--probee-gold-muted)] text-gold"
                : "border-[var(--probee-border-subtle)] bg-surface-2 text-text-secondary hover:border-[var(--probee-border-default)] hover:bg-surface-3 hover:text-text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
