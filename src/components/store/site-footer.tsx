import Link from "next/link";
import { BrandMark, Container } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer
      id="support"
      className="border-t border-[var(--probee-border-subtle)] bg-surface-1"
    >
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-sm text-sm leading-6 text-text-muted">
              A premium storefront foundation designed to support a flexible
              digital-product catalog.
            </p>
          </div>

          <div>
            <h2 className="probee-label">Store</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/products">
                Products
              </Link>
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/#categories">
                Categories
              </Link>
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/cart">
                Cart
              </Link>
            </div>
          </div>

          <div>
            <h2 className="probee-label">Support</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/#support">
                Help & Support
              </Link>
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/#why-probee">
                Why ProBee
              </Link>
            </div>
          </div>

          <div>
            <h2 className="probee-label">Account</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/account">
                Account
              </Link>
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/orders">
                Orders
              </Link>
            </div>
          </div>

          <div>
            <h2 className="probee-label">Legal</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <Link className="probee-focus-ring rounded text-text-secondary hover:text-text-primary" href="/legal">
                Legal
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--probee-border-subtle)] pt-6 text-xs text-text-muted">
          <p>© {new Date().getFullYear()} ProBee. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
