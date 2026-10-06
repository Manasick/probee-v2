import Link from "next/link";
import { Surface } from "@/components/ui";

export function AdminErrorState({
  title = "Unable to load catalog data",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <Surface tone="muted" className="mt-8 border-red-400/30" role="alert">
      <p className="font-semibold text-red-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-red-200/80">{message}</p>
      <Link
        href="/admin/products"
        className="probee-focus-ring mt-5 inline-flex min-h-11 items-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
      >
        Return to products
      </Link>
    </Surface>
  );
}
