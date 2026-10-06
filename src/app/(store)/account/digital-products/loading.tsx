import { Container, LoadingState } from "@/components/ui";

export default function DigitalProductsLoading() {
  return (
    <section className="probee-section">
      <Container>
        <LoadingState label="Loading your digital access…" />
      </Container>
    </section>
  );
}