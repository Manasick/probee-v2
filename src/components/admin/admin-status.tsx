interface AdminStatusProps {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

const tones = {
  neutral: "border-[var(--probee-border-default)] bg-surface-2 text-text-secondary",
  success: "border-emerald-300/20 bg-emerald-300/5 text-emerald-100",
  warning: "border-amber-300/20 bg-amber-300/5 text-amber-100",
  danger: "border-red-300/20 bg-red-300/5 text-red-100",
  info: "border-sky-300/20 bg-sky-300/5 text-sky-100",
};

export function AdminStatus({
  label,
  tone = "neutral",
}: AdminStatusProps) {
  return (
    <span
      className={[
        "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
        tones[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
