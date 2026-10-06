import { Container, Surface } from "@/components/ui";

export default function AdminReviewsLoading() {
  return (
    <section className="probee-section">
      <Container>
        <Surface className="min-h-56 animate-pulse p-8">
          <div className="h-3 w-20 rounded bg-surface-3" />
          <div className="mt-4 h-8 w-64 rounded bg-surface-3" />
          <div className="mt-5 h-4 w-full max-w-xl rounded bg-surface-3" />
        </Surface>
      </Container>
    </section>
  );
}
