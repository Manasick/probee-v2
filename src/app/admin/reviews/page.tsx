import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { requireStaff } from "@/lib/admin/auth";
import { getAdminReviews } from "@/lib/reviews/server";
import type { ReviewStatus } from "@/lib/reviews/types";
import { moderateReviewAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["pending", "approved", "rejected", "hidden", "all"] as const;

function getStatus(
  value: string | string[] | undefined,
): ReviewStatus | "all" {
  const raw = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return STATUS_FILTERS.includes(raw as (typeof STATUS_FILTERS)[number])
    ? (raw as ReviewStatus | "all")
    : "pending";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function stars(rating: number): string {
  return "★".repeat(Math.max(0, Math.min(5, rating)));
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;
  const status = getStatus(params.status);
  const success = Array.isArray(params.success)
    ? params.success[0]
    : params.success;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const result = await getAdminReviews(status);

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Reviews</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Review moderation
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Only staff can moderate reviews. Approved reviews are the only
            reviews visible on the public storefront.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <Link
              key={item}
              href={
                item === "pending"
                  ? "/admin/reviews"
                  : "/admin/reviews?status=" + item
              }
              className={[
                "probee-focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold capitalize",
                status === item
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-[var(--probee-border-subtle)] bg-surface-2 text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              {item}
            </Link>
          ))}
        </div>

        {success ? (
          <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4">
            <p className="text-sm text-emerald-100">{success}</p>
          </Surface>
        ) : null}

        {error ? (
          <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4">
            <p className="text-sm text-red-100">{error}</p>
          </Surface>
        ) : null}

        <div className="mt-8 grid gap-5">
          {result.items.map((review) => (
            <Surface key={review.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="probee-label">{review.productName}</p>
                  <h2 className="mt-2 text-lg font-semibold">
                    {review.title || "Customer review"}
                  </h2>
                  <p className="mt-1 text-xs text-text-muted">
                    {review.reviewerName} · {formatDate(review.createdAt)}
                  </p>
                  <p
                    className="mt-3 text-sm text-gold"
                    aria-label={review.rating + " out of 5 stars"}
                  >
                    {stars(review.rating)}
                  </p>
                </div>

                <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--probee-border-default)] bg-surface-2 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  {review.status}
                </span>
              </div>

              <p className="mt-5 whitespace-pre-line text-sm leading-6 text-text-secondary">
                {review.body}
              </p>

              {review.moderationReason ? (
                <div className="mt-4 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
                    Internal moderation note
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {review.moderationReason}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 border-t border-[var(--probee-border-subtle)] pt-5">
                <form
                  action={moderateReviewAction}
                  className="grid gap-3 lg:grid-cols-[180px_1fr_auto]"
                >
                  <input type="hidden" name="reviewId" value={review.id} />
                  <select
                    name="status"
                    defaultValue={review.status}
                    className="min-h-11 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                  >
                    {["pending", "approved", "rejected", "hidden"].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <input
                    name="reason"
                    type="text"
                    maxLength={500}
                    defaultValue=""
                    placeholder="Internal moderation note (optional)"
                    className="min-h-11 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                  />
                  <button
                    type="submit"
                    className="probee-focus-ring min-h-11 rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                  >
                    Save status
                  </button>
                </form>
              </div>
            </Surface>
          ))}

          {result.items.length === 0 ? (
            <Surface className="p-6">
              <p className="text-sm font-semibold">No reviews in this queue.</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                New eligible reviews will appear here after customers submit them.
              </p>
            </Surface>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
