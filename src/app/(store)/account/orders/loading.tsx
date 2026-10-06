import { Container, LoadingState } from "@/components/ui";

export default function AccountOrdersLoading() {
  return (
    <section className="probee-section">
      <Container>
        <LoadingState label="Loading your orders…" />
      </Container>
    </section>
  );
}
