import { Container, LoadingState, Surface } from "@/components/ui";

export default function AdminProductsLoading() {
  return (
    <section className="probee-section">
      <Container>
        <Surface className="p-8">
          <LoadingState label="Loading product catalog…" />
        </Surface>
      </Container>
    </section>
  );
}
