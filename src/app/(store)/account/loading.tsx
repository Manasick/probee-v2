import { Container, LoadingState } from "@/components/ui";

export default function AccountLoading() {
  return (
    <section className="probee-section">
      <Container>
        <LoadingState label="Loading your account…" />
      </Container>
    </section>
  );
}
