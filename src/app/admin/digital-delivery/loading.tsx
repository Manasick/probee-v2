import { Container, LoadingState } from "@/components/ui";

export default function DigitalDeliveryLoading() {
  return (
    <section className="probee-section">
      <Container>
        <LoadingState label="Loading digital fulfillment…" />
      </Container>
    </section>
  );
}