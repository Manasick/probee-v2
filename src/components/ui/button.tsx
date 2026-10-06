import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gold text-text-inverse hover:bg-gold-hover",
  secondary:
    "border border-[var(--probee-border-default)] bg-surface-2 text-text-primary hover:border-[var(--probee-border-strong)] hover:bg-surface-3",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--probee-radius-md)] font-semibold",
        "transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50",
        "probee-focus-ring",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
