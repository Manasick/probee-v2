import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark, Container, Surface } from "@/components/ui";

export default function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[var(--probee-border-subtle)] bg-background/90">
        <Container className="flex min-h-16 items-center justify-between">
          <Link
            href="/"
            className="probee-focus-ring rounded-[var(--probee-radius-sm)]"
            aria-label="ProBee home"
          >
            <BrandMark />
          </Link>

          <Link
            href="/products"
            className="probee-focus-ring rounded text-sm font-semibold text-text-secondary hover:text-text-primary"
          >
            Browse products
          </Link>
        </Container>
      </header>

      <main className="probee-section">
        <Container>
          <div className="mx-auto max-w-md">
            <Surface className="p-5 sm:p-8">{children}</Surface>
          </div>
        </Container>
      </main>
    </div>
  );
}
