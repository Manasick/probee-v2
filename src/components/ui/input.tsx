import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      ) : null}

      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={[
          "min-h-11 w-full rounded-[var(--probee-radius-md)] border bg-surface-1 px-3.5 text-sm text-text-primary",
          "border-[var(--probee-border-default)] placeholder:text-text-muted",
          "transition-colors duration-200",
          "hover:border-[var(--probee-border-strong)]",
          "focus:border-gold focus:outline-none focus:ring-2 focus:ring-[var(--probee-focus-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />

      {hint ? (
        <p id={hintId} className="mt-2 text-sm text-text-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
