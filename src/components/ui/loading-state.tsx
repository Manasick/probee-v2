import type { HTMLAttributes } from "react";

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function LoadingState({
  label = "Loading",
  className = "",
  ...props
}: LoadingStateProps) {
  return (
    <div
      className={`inline-flex items-center gap-3 text-sm text-text-secondary ${className}`}
      role="status"
      aria-live="polite"
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-[var(--probee-border-default)] border-t-gold"
      />
      <span>{label}</span>
    </div>
  );
}
