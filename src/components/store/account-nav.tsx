import Link from "next/link";

export function AccountNav() {
  return (
    <nav
      aria-label="Account navigation"
      className="grid gap-2 sm:flex sm:flex-wrap"
    >
      {[
        { label: "Overview", href: "/account" },
        { label: "Orders", href: "/account/orders" },
        { label: "Digital products", href: "/account/digital-products" },
        { label: "Profile", href: "/account#profile" },
        { label: "Security", href: "/account#security" },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="probee-focus-ring rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:border-[var(--probee-border-default)] hover:bg-surface-3 hover:text-text-primary"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}