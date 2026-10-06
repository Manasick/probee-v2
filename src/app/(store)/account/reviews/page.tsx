import Link from "next/link";
import { AccountNav } from "@/components/store/account-nav";
import { Container, Surface } from "@/components/ui";
import { requireAuthenticated } from "@/lib/auth/server";
import { getMyReviewDashboard } from "@/lib/reviews/server";
import { createReviewAction, updateReviewAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_META = {
  pending: {
    label: "Pending moderation",
    classes: "border-amber-300/20 bg-amber-300/5 text-amber-100",
  },
  approved: {
    label: "Published",
    classes: "border-emerald-300/20 bg-emerald-300/5 text-emerald-100",
  },
  rejected: {
    label: "Rejected",
    classes: "border-red-300/20 bg-red-300/5 text-red-100",
  },
  hidden: {
    label: "Hidden",
    classes: "border-violet-300/20 bg-violet-300/5 text-violet-100",
  },
} as const;

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AccountReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuthenticated("/account/reviews");
  const params = await searchParams;
  const productId = getParam(params, "product");
  const editId = getParam(params, "edit");
  const success = getParam(params, "success");
  const error = getParam(params, "error");
  const dashboard = await getMyReviewDashboard();

  const selectedReview =
    dashboard.reviews.find((review) => review.id === editId) ?? null;
  const selectedEligibleProduct =
    dashboard.eligibleProducts.find((item) => item.productId === productId) ??
    null;

  const showCreateForm = Boolean(selectedEligibleProduct);
  const showEditForm = Boolean(selectedReview);

  return (
    <section className="probee-section">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Customer reviews</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Your reviews
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Reviews are limited to real paid purchases and are checked by ProBee
            moderation before they become public.
          </p>
        </div>

        <div className="mt-8">
          <AccountNav />
        </div>

        {success ? (
          <Surface className="mt-6 border-emerald-300/20 bg-emerald-300/5 p-4" role="status">
            <p className="text-sm text-emerald-100">{success}</p>
          </Surface>
        ) : null}

        {error ? (
          <Surface className="mt-6 border-red-300/20 bg-red-300/5 p-4" role="alert">
            <p className="text-sm text-red-100">{error}</p>
          </Surface>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Eligible purchases</p>
              <h2 className="mt-2 text-xl font-semibold">Products you can review</h2>

              {dashboard.eligibleProducts.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  {dashboard.eligibleProducts.map((item) => (
                    <div
                      key={item.productId}
                      className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4"
                    >
                      <p className="font-semibold">{item.productName}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Purchased in {item.orderReference}
                      </p>
                      <Link
                        href={
                          "/account/reviews?product=" +
                          encodeURIComponent(item.productId)
                        }
                        className="probee-focus-ring mt-4 inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                      >
                        Write a review
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-text-muted">
                  There are no eligible products waiting for a review.
                </p>
              )}
            </Surface>

            <Surface className="p-6 sm:p-8">
              <p className="probee-label">Your review history</p>
              <h2 className="mt-2 text-xl font-semibold">Submitted reviews</h2>

              {dashboard.reviews.length > 0 ? (
                <div className="mt-5 grid gap-4">
                  {dashboard.reviews.map((review) => {
                    const status = STATUS_META[review.status];

                    return (
                      <article
                        key={review.id}
                        className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold">{review.productName}</p>
                            <p className="mt-1 text-xs text-text-muted">
                              Rating {review.rating}/5
                            </p>
                          </div>
                          <span
                            className={[
                              "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold",
                              status.classes,
                            ].join(" ")}
                          >
                            {status.label}
                          </span>
                        </div>

                        {review.title ? (
                          <p className="mt-4 text-sm font-semibold">
                            {review.title}
                          </p>
                        ) : null}
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
                          {review.body}
                        </p>
                        {review.status === "rejected" || review.status === "hidden" ? (
                          <p className="mt-3 text-xs leading-5 text-text-muted">
                            You can edit this review and submit it again for moderation.
                          </p>
                        ) : null}
                        <Link
                          href={
                            "/account/reviews?edit=" +
                            encodeURIComponent(review.id)
                          }
                          className="probee-focus-ring mt-4 inline-flex min-h-10 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-3 px-4 text-sm font-semibold text-text-secondary hover:text-text-primary"
                        >
                          Edit review
                        </Link>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-text-muted">
                  You have not submitted any reviews yet.
                </p>
              )}
            </Surface>
          </div>

          <div>
            {showCreateForm || showEditForm ? (
              <Surface className="p-6 sm:p-8">
                <p className="probee-label">
                  {showEditForm ? "Edit review" : "New review"}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {showEditForm
                    ? selectedReview?.productName
                    : selectedEligibleProduct?.productName}
                </h2>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  {showEditForm && selectedReview?.status === "approved"
                    ? "Editing a published review sends it back to pending moderation."
                    : "Keep your review clear and useful. Review text is stored as plain text."}
                </p>

                <form
                  action={showEditForm ? updateReviewAction : createReviewAction}
                  className="mt-6 grid gap-5"
                >
                  {showEditForm ? (
                    <input
                      type="hidden"
                      name="reviewId"
                      value={selectedReview?.id ?? ""}
                    />
                  ) : (
                    <input
                      type="hidden"
                      name="productId"
                      value={selectedEligibleProduct?.productId ?? ""}
                    />
                  )}

                  <div>
                    <label
                      htmlFor="review-rating"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      Rating
                    </label>
                    <select
                      id="review-rating"
                      name="rating"
                      defaultValue={String(
                        showEditForm ? selectedReview?.rating ?? 5 : 5,
                      )}
                      className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                    >
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <option key={rating} value={rating}>
                          {rating} {rating === 1 ? "star" : "stars"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="review-title"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      Title <span className="text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="review-title"
                      name="title"
                      type="text"
                      maxLength={120}
                      defaultValue={showEditForm ? selectedReview?.title ?? "" : ""}
                      className="min-h-11 w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                      placeholder="A short summary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="review-body"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      Review
                    </label>
                    <textarea
                      id="review-body"
                      name="body"
                      required
                      maxLength={2000}
                      rows={7}
                      defaultValue={showEditForm ? selectedReview?.body ?? "" : ""}
                      className="w-full rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-2 px-3.5 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-gold focus:ring-2 focus:ring-[var(--probee-focus-ring)]"
                      placeholder="Share your experience with this product."
                    />
                  </div>

                  <button
                    type="submit"
                    className="probee-focus-ring inline-flex min-h-11 items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                  >
                    {showEditForm ? "Update review" : "Submit review"}
                  </button>
                </form>
              </Surface>
            ) : (
              <Surface className="p-6 sm:p-8">
                <p className="probee-label">Review editor</p>
                <h2 className="mt-2 text-xl font-semibold">
                  Select a purchased product
                </h2>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  Choose an eligible product or an existing review to begin.
                </p>
              </Surface>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
