"use client";

import Link from "next/link";
import { Container, Surface } from "@/components/ui";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="probee-section">
      <Container>
        <Surface className="p-6" role="alert">
          <p className="probee-label">Admin error</p>
          <h1 className="mt-2 text-2xl font-semibold">This admin section could not be loaded.</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            The operation failed safely. Technical database details are not exposed in the dashboard.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => reset()} className="probee-focus-ring min-h-11 rounded-lg bg-gold px-4 text-sm font-semibold text-text-inverse">
              Try again
            </button>
            <Link href="/admin" className="probee-focus-ring inline-flex min-h-11 items-center rounded-lg border border-[var(--probee-border-default)] px-4 text-sm font-semibold">
              Dashboard
            </Link>
          </div>
        </Surface>
      </Container>
    </section>
  );
}
