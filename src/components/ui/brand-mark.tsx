import type { HTMLAttributes } from "react";

export function BrandMark({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`probee-brand-mark inline-flex items-center gap-2.5 text-base font-semibold tracking-[0.04em] text-text-primary ${className}`} aria-label="ProBee" {...props}>
      <span className="probee-brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 42 42" fill="none">
          <path d="M9 24c-1.8-5.8 1.1-12.1 6.7-14.2 5-1.9 10.8.2 13.1 5 2.9-1.5 6.4-.1 7.4 2.9 1.2 3.6-.9 7.6-4.7 8.4-2.2.5-4.4-.2-5.8-1.9-2.4 5-8.6 7.4-13.6 4.7C10.1 27.6 9.2 25.9 9 24Z" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round"/>
          <path d="M16.5 12.6 12 6.8M25 13.1l4.5-6.3" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"/>
          <path d="M18 18c2.5 1.5 5 1.8 7.5.8M17.3 23.1c2.5 1.5 5 1.8 7.5.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
      </span>
      <span className="leading-none">Pro<span className="probee-gold-text">Bee</span></span>
    </span>
  );
}
