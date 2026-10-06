import { Container, Surface } from "@/components/ui";

export function AdminLoading({
  title = "Loading administration data…",
}: {
  title?: string;
}) {
  return (
    <section className="probee-section">
      <Container>
        <Surface className="p-6" aria-live="polite">
          <p className="probee-label">ProBee Admin</p>
          <p className="mt-2 text-sm text-text-muted">{title}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="h-20 animate-pulse rounded-lg bg-surface-2" />
            <div className="h-20 animate-pulse rounded-lg bg-surface-2" />
            <div className="h-20 animate-pulse rounded-lg bg-surface-2" />
          </div>
        </Surface>
      </Container>
    </section>
  );
}
