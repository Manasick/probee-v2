import { Container, LoadingState } from "@/components/ui";

export default function DigitalDeliveryAssetsLoading() {
  return (
    <section className="probee-section">
      <Container>
        <LoadingState label="Loading digital delivery assets…" />
      </Container>
    </section>
  );
}