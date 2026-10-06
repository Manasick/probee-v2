import type { HTMLAttributes } from "react";

type SurfaceTone = "default" | "muted" | "glass" | "interactive";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: SurfaceTone;
}

const toneClasses: Record<SurfaceTone, string> = {
  default:
    "border border-[var(--probee-border-subtle)] bg-surface-1 shadow-[var(--probee-shadow-sm)]",
  muted:
    "border border-[var(--probee-border-subtle)] bg-surface-2",
  glass:
    "probee-glass shadow-[var(--probee-shadow-sm)]",
  interactive:
    "border border-[var(--probee-border-subtle)] bg-surface-1 shadow-[var(--probee-shadow-sm)] probee-interactive hover:border-[var(--probee-border-default)] hover:bg-surface-2 hover:shadow-[var(--probee-shadow-md)]",
};

export function Surface({
  tone = "default",
  className = "",
  ...props
}: SurfaceProps) {
  return (
    <div
      className={[
        "rounded-[var(--probee-radius-lg)]",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
