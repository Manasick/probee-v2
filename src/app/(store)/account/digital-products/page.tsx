import Link from "next/link";
import { Container, Surface } from "@/components/ui";
import { EmptyState } from "@/components/store/empty-state";
import { AccountNav } from "@/components/store/account-nav";
import { requireAuthenticated } from "@/lib/auth/server";
import { formatDate } from "@/lib/orders/presentation";
import { formatDigitalAssetSize } from "@/lib/digital-delivery/assets";
import { getMyDigitalEntitlements } from "@/lib/digital-delivery/server";

export const dynamic = "force-dynamic";

function statusClasses(status: string, allowed: boolean): string {
  if (!allowed) return "border-amber-300/20 bg-amber-300/5 text-amber-100";
  if (status === "active") {
    return "border-emerald-300/20 bg-emerald-300/5 text-emerald-100";
  }
  if (status === "suspended") {
    return "border-amber-300/20 bg-amber-300/5 text-amber-100";
  }
  if (status === "revoked" || status === "expired") {
    return "border-red-300/20 bg-red-300/5 text-red-100";
  }
  return "border-[var(--probee-border-default)] bg-surface-2 text-text-secondary";
}

export default async function DigitalProductsPage() {
  await requireAuthenticated("/account/digital-products");
  const { entitlements, error } = await getMyDigitalEntitlements();

  return (
    <section className="probee-section probee-digital-page">
      <Container>
        <div className="max-w-4xl">
          <p className="probee-label">Digital products</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
            Your digital access
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            Access only digital products fulfilled to your authenticated ProBee
            account.
          </p>
        </div>

        <div className="mt-8">
          <AccountNav />
        </div>

        {error ? (
          <Surface className="mt-8 border-red-300/20 bg-red-300/5 p-6" role="alert">
            <p className="text-sm font-semibold text-red-100">
              Digital access could not be loaded.
            </p>
            <p className="mt-2 text-sm leading-6 text-red-100/70">
              Please refresh the page or try again later.
            </p>
          </Surface>
        ) : entitlements.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No digital access yet"
              description="Paid digital purchases fulfilled by ProBee will appear here."
              action={
                <Link
                  href="/account/orders"
                  className="probee-focus-ring inline-flex min-h-11 items-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover"
                >
                  View orders
                </Link>
              }
            />
          </div>
        ) : (
          <div className="probee-digital-grid mt-8 grid gap-6">
            {entitlements.map((entitlement) => (
              <Surface key={entitlement.id} className="p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
                      Order {entitlement.orderReference}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      {entitlement.productName}
                    </h2>
                    {entitlement.planName ? (
                      <p className="mt-1 text-sm text-text-secondary">
                        {entitlement.planName}
                      </p>
                    ) : null}
                    <Link
                      href={
                        "/account/orders/" +
                        encodeURIComponent(entitlement.orderReference)
                      }
                      className="probee-focus-ring mt-2 inline-flex rounded text-xs font-semibold text-gold hover:text-gold-hover"
                    >
                      View order
                    </Link>
                  </div>

                  <span
                    className={[
                      "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
                      statusClasses(
                        entitlement.accessStatus,
                        entitlement.accessAllowed,
                      ),
                    ].join(" ")}
                  >
                    {entitlement.accessAllowed
                      ? entitlement.accessStatus
                      : entitlement.accessStatus === "active"
                        ? "Access unavailable"
                        : entitlement.accessStatus}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
                      Delivery
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {entitlement.deliveryType || "Digital access"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
                      Fulfilled
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {entitlement.fulfilledAt
                        ? formatDate(entitlement.fulfilledAt)
                        : "Not recorded"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
                      Expires
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {entitlement.expiresAt
                        ? formatDate(entitlement.expiresAt)
                        : "No expiration set"}
                    </p>
                  </div>
                </div>

                {entitlement.deliveryInstructions ? (
                  <div className="mt-6 rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4">
                    <p className="text-xs uppercase tracking-[0.1em] text-text-muted">
                      Instructions
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
                      {entitlement.deliveryInstructions}
                    </p>
                  </div>
                ) : null}

                {entitlement.customerAccessUrl && entitlement.accessAllowed ? (
                  <a
                    href={entitlement.customerAccessUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="probee-focus-ring mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--probee-radius-md)] bg-gold px-4 text-sm font-semibold text-text-inverse hover:bg-gold-hover sm:w-auto"
                  >
                    Open customer access
                  </a>
                ) : null}

                {entitlement.assets.length > 0 ? (
                  <div className="mt-6">
                    <p className="text-sm font-semibold">Files</p>
                    <div className="mt-3 grid gap-3">
                      {entitlement.assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="rounded-[var(--probee-radius-md)] border border-[var(--probee-border-subtle)] bg-surface-2 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium">{asset.title}</p>
                              {asset.description ? (
                                <p className="mt-1 text-sm leading-6 text-text-muted">
                                  {asset.description}
                                </p>
                              ) : null}
                              <p className="mt-2 text-xs text-text-muted">
                                {asset.mimeType} ·{" "}
                                {formatDigitalAssetSize(asset.fileSizeBytes)}
                              </p>
                              {asset.customerInstructions ? (
                                <p className="mt-2 text-xs leading-5 text-text-muted">
                                  {asset.customerInstructions}
                                </p>
                              ) : null}
                            </div>

                            {entitlement.accessAllowed ? (
                              <a
                                href={
                                  "/api/digital-delivery/" +
                                  encodeURIComponent(entitlement.id) +
                                  "/" +
                                  encodeURIComponent(asset.id)
                                }
                                className="probee-focus-ring inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-[var(--probee-radius-md)] border border-[var(--probee-border-default)] bg-surface-1 px-3 text-xs font-semibold text-text-primary hover:bg-surface-3 sm:w-auto"
                              >
                                Access file
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!entitlement.accessAllowed ? (
                  <div className="mt-5 rounded-[var(--probee-radius-md)] border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">
                    Access is currently unavailable. The entitlement, order, or
                    payment state must be eligible before digital access can be used.
                  </div>
                ) : null}
              </Surface>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}