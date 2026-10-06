import type { ReactNode } from "react";
import { Surface } from "@/components/ui";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Surface className="px-6 py-10 text-center sm:px-10">
      <div className="mx-auto max-w-xl">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border border-[var(--probee-border-default)] bg-surface-2 text-gold">
          <span aria-hidden="true">•</span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {description}
        </p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </Surface>
  );
}
