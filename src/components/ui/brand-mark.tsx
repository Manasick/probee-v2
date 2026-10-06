import type { HTMLAttributes } from "react";

export function BrandMark({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center text-base font-semibold tracking-[0.08em] text-text-primary ${className}`}
      aria-label="ProBee"
      {...props}
    >
      ProBee
    </span>
  );
}
