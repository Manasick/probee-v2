"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/ui";
import { useCart } from "@/lib/cart/provider";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Categories", href: "/#categories" },
  { label: "Why ProBee", href: "/#why-probee" },
];

interface SiteHeaderProps {
  accountEmail?: string | null;
  emailVerified?: boolean;
}

export function SiteHeader({ accountEmail = null, emailVerified = false }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount } = useCart();

  const accountLabel = accountEmail ? "Account" : "Sign in";
  const cartLabel = itemCount === 0
    ? "Shopping cart"
    : `Shopping cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`;

  return (
    <header className="probee-site-header sticky top-0 z-50">
      <div className="probee-container">
        <div className="flex min-h-[4.5rem] items-center justify-between gap-4">
          <Link
            href="/"
            className="probee-focus-ring rounded-xl"
            aria-label="ProBee home"
            onClick={() => setMenuOpen(false)}
          >
            <BrandMark />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="probee-header-link probee-focus-ring rounded-full px-4 py-2.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="probee-header-icon probee-focus-ring"
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </button>

            <Link href="/cart" className="probee-header-icon probee-focus-ring relative" aria-label={cartLabel}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 5h2l1.5 10h9.9l2-7.5H7" />
                <circle cx="10" cy="19" r="1.2" />
                <circle cx="17" cy="19" r="1.2" />
              </svg>
              {itemCount > 0 ? (
                <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full border border-background bg-gold px-1 text-[0.625rem] font-bold leading-4 text-text-inverse">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              ) : null}
            </Link>

            <Link
              href={accountEmail ? "/account" : "/login"}
              className="probee-header-account probee-focus-ring hidden md:inline-flex"
              title={accountEmail ?? "Sign in"}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5.5 20c.9-3.4 3.1-5.1 6.5-5.1s5.6 1.7 6.5 5.1" />
              </svg>
              <span>{accountLabel}</span>
              {accountEmail && !emailVerified ? <span className="probee-account-dot" aria-label="Account needs activation" /> : null}
            </Link>

            <button
              type="button"
              className="probee-header-icon probee-focus-ring lg:hidden"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[1.2rem]" fill="none" stroke="currentColor" strokeWidth="1.8">
                {menuOpen ? (
                  <>
                    <path d="m6 6 12 12" />
                    <path d="m18 6-12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {searchOpen ? (
          <div className="probee-header-search">
            <label className="sr-only" htmlFor="global-search">Search ProBee</label>
            <div className="relative">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                id="global-search"
                type="search"
                placeholder="Search the ProBee collection..."
                className="probee-search-input probee-focus-ring"
              />
            </div>
          </div>
        ) : null}

        {menuOpen ? (
          <nav id="mobile-navigation" className="probee-mobile-menu lg:hidden" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="probee-mobile-link probee-focus-ring">
                {item.label}
              </Link>
            ))}
            <Link href={accountEmail ? "/account" : "/login"} onClick={() => setMenuOpen(false)} className="probee-mobile-link probee-focus-ring">
              {accountLabel}
              {accountEmail && !emailVerified ? <span className="probee-account-pill">Activate</span> : null}
            </Link>
            <Link href="/cart" onClick={() => setMenuOpen(false)} className="probee-mobile-link probee-focus-ring">
              Cart <span className="probee-cart-pill">{itemCount}</span>
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
