"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/ui";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Categories", href: "/#categories" },
  { label: "Why ProBee", href: "/#why-probee" },
  { label: "Support", href: "/#support" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--probee-border-subtle)] bg-background/90 backdrop-blur-xl">
      <div className="probee-container">
        <div className="flex min-h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="probee-focus-ring shrink-0 rounded-[var(--probee-radius-sm)]"
            aria-label="ProBee home"
            onClick={closeMenu}
          >
            <BrandMark />
          </Link>

          <nav
            className="hidden items-center gap-6 lg:flex"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="probee-focus-ring rounded-md probee-nav transition-colors hover:text-text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="probee-focus-ring rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </button>

            <Link
              href="/cart"
              className="probee-focus-ring rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              aria-label="Shopping cart"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 5h2l1.5 10h9.9l2-7.5H7" />
                <circle cx="10" cy="19" r="1.2" />
                <circle cx="17" cy="19" r="1.2" />
              </svg>
            </Link>

            <button
              type="button"
              disabled
              className="probee-focus-ring hidden rounded-lg p-2 text-text-muted opacity-60 md:inline-flex"
              aria-label="Account coming soon"
              title="Account coming soon"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5.5 20c.9-3.4 3.1-5.1 6.5-5.1s5.6 1.7 6.5 5.1" />
              </svg>
            </button>

            <button
              type="button"
              className="probee-focus-ring rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary lg:hidden"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
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
          <div className="border-t border-[var(--probee-border-subtle)] py-3">
            <label className="sr-only" htmlFor="global-search">
              Search ProBee
            </label>
            <input
              id="global-search"
              type="search"
              placeholder="Search products"
              className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
            />
            <p className="mt-2 text-xs text-text-muted">
              Search is prepared for the future catalog query layer.
            </p>
          </div>
        ) : null}

        {menuOpen ? (
          <nav
            id="mobile-navigation"
            className="border-t border-[var(--probee-border-subtle)] py-3 lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="grid gap-1 pb-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="probee-focus-ring rounded-lg px-3 py-3 text-sm font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="border-t border-[var(--probee-border-subtle)] pt-2">
              <span className="block px-3 py-3 text-sm text-text-muted">
                Account will be enabled with authentication.
              </span>
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
