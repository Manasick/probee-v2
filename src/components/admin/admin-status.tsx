interface AdminStatusProps {
  label: string;
  tone?: "neutral" | "success" | "warning";
}

const tones = {
  neutral: "border-[var(--probee-border-default)] bg-surface-2 text-text-secondary",
  success: "border-[var(--probee-border-default)] bg-gold-soft text-gold",
  warning: "border-red-400/30 bg-red-400/10 text-red-200",
};

export function AdminStatus({
  label,
  tone = "neutral",
}: AdminStatusProps) {
  return (
    <span
      className={[
        "inline-flex min-h-7 items-center rounded-full border px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em]",
        tones[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
