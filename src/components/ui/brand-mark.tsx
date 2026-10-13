import Image from "next/image";
import type { HTMLAttributes } from "react";

export function BrandMark({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`probee-brand-mark inline-flex items-center gap-2.5 text-base font-semibold tracking-[0.04em] text-text-primary ${className}`} aria-label="ProBee" {...props}>
      <Image
        src="/ffcf624e-0ef2-4cd1-8d49-e40c407363b9.jpeg"
        alt=""
        width={42}
        height={42}
        priority
        className="h-[42px] w-[42px] shrink-0 object-contain"
      />
      <span className="leading-none">Pro<span className="probee-gold-text">Bee</span></span>
    </span>
  );
}
