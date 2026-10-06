import Link from "next/link";
import { Surface } from "@/components/ui";
import { getProductReviewSummary, getProductReviews } from "@/lib/reviews/server";
import type { ReviewSort } from "@/lib/reviews/types";

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span
      className="tracking-[0.12em] text-gold"
      aria-label={rating.toFixed(1) + " out of 5 stars"}
    >
      {"★".repeat(filled)}
      <span className="text-text-muted">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export async function ProductReviews({
  productId,
  page,
  sort,
}: {
  productId: string;
  page: number;
  sort: ReviewSort;
}) {
  const [summary, reviews] = await Promise.all([
    getProductReviewSummary(productId),
    getProductReviews(productId, { limit: 5, page, sort }),
  ]);

  const totalPages = Math.max(1, Math.ceil(summary.reviewCount / 5));

  return (
    <section className="mt-14 border-t border-[var(--probee-border-subtle)] pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="probee-label">Customer reviews</p>
          <h2 className="mt-2 text-2xl font-semibold">Reviews</h2>
        </div>
        <Link
          href={"/account/reviews?product=" + encodeURIComponent(productId)}
          className="probee-focus-ring inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 text-sm font-semibold text-text-secondary hover:bg-surface-3 hover:text-text-primary"
        >
          Write a review
        </Link>
      </div>

      <Surface className="mt-5 p-5 sm:p-6">
        {summary.reviewCount > 0 ? (
          <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div>
              <p className="text-3xl font-semibold text-gold">
                {summary.averageRating.toFixed(1)}
              </p>
              <div className="mt-1">
                <Stars rating={summary.averageRating} />
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {summary.reviewCount}{" "}
                {summary.reviewCount === 1 ? "review" : "reviews"}
              </p>
            </div>

            <div className="grid gap-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count =
                  summary.distribution[
                    String(rating) as "1" | "2" | "3" | "4" | "5"
                  ];
                const width =
                  summary.reviewCount > 0
                    ? Math.round((count / summary.reviewCount) * 100)
                    : 0;

                return (
                  <div
                    key={rating}
                    className="grid grid-cols-[2rem_1fr_2.5rem] items-center gap-2 text-xs text-text-muted"
                  >
                    <span>{rating}★</span>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-3"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: width + "%" }}
                      />
                    </div>
                    <span className="text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-3">
            <p className="text-base font-semibold">No reviews yet</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Verified customers can share the first review after a successful purchase.
            </p>
          </div>
        )}
      </Surface>

      {summary.reviewCount > 0 ? (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {(["newest", "highest", "lowest"] as const).map((value) => (
              <Link
                key={value}
                href={"?reviewSort=" + value + "&reviewPage=1"}
                className={[
                  "probee-focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold capitalize",
                  value === sort
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-[var(--probee-border-subtle)] bg-surface-2 text-text-muted hover:text-text-primary",
                ].join(" ")}
              >
                {value}
              </Link>
            ))}
          </div>

          <div className="mt-5 grid gap-4">
            {reviews.items.map((review) => (
              <article
                key={review.id}
                className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Stars rating={review.rating} />
                    <p className="mt-2 text-sm font-semibold text-text-primary">
                      {review.title || "Customer review"}
                    </p>
                  </div>
                  <p className="text-xs text-text-muted">
                    {formatDate(review.createdAt)}
                  </p>
                </div>

                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">
                  {review.body}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
                  <span>{review.displayName}</span>
                  {review.isVerifiedPurchase ? (
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-semibold text-gold">
                      Verified Purchase
                    </span>
                  ) : null}
                </div>
              </article>
            ))}

            {reviews.items.length === 0 ? (
              <p className="text-sm text-text-muted">
                No approved reviews are available on this page.
              </p>
            ) : null}
          </div>

          {totalPages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--probee-border-subtle)] pt-5">
              <p className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={"?reviewSort=" + sort + "&reviewPage=" + String(page - 1)}
                    className="probee-focus-ring rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-3"
                  >
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={"?reviewSort=" + sort + "&reviewPage=" + String(page + 1)}
                    className="probee-focus-ring rounded-[var(--probee-radius-md)] bg-gold px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
