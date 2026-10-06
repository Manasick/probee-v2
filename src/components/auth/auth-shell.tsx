import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark, Container, Surface } from "@/components/ui";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <Container className="flex min-h-screen items-center py-10 sm:py-16">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="probee-focus-ring mb-8 inline-flex rounded-lg"
            aria-label="Return to ProBee home"
          >
            <BrandMark />
          </Link>

          <Surface className="p-6 sm:p-8">
            <p className="probee-label">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              {description}
            </p>

            <div className="mt-7">{children}</div>
          </Surface>
        </div>
      </Container>
    </main>
  );
}
