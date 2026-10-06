import { Container, LoadingState } from "@/components/ui";

export default function AccountOrderDetailsLoading() {
  return (
    <section className="probee-section">
      <Container>
        <LoadingState label="Loading your order…" />
      </Container>
    </section>
  );
}
