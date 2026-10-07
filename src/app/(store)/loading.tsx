import { BrandMark } from "@/components/ui";

export default function Loading() {
  return (
    <main className="probee-cinematic-loader" aria-label="Loading ProBee">
      <div className="probee-loader-grid" aria-hidden="true" />
      <div className="probee-loader-glow probee-loader-glow-one" aria-hidden="true" />
      <div className="probee-loader-glow probee-loader-glow-two" aria-hidden="true" />
      <div className="probee-loader-orbit probee-loader-orbit-one" aria-hidden="true" />
      <div className="probee-loader-orbit probee-loader-orbit-two" aria-hidden="true" />
      <div className="probee-loader-core">
        <div className="probee-loader-bee" aria-hidden="true">
          <span className="loader-wing loader-wing-left" />
          <span className="loader-wing loader-wing-right" />
          <span className="loader-body" />
        </div>
        <BrandMark className="text-[1.65rem]" />
        <div className="probee-loader-line" aria-hidden="true"><span /></div>
        <p>Initializing premium experience</p>
      </div>
    </main>
  );
}
