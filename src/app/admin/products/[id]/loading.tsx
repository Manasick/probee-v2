import { Container, LoadingState, Surface } from "@/components/ui";

export default function AdminProductEditorLoading() {
  return (
    <section className="probee-section">
      <Container>
        <Surface className="p-8">
          <LoadingState label="Loading product editor…" />
        </Surface>
      </Container>
    </section>
  );
}
