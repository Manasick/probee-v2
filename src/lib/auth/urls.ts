export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  }

  const vercelUrl =
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ??
    process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return "https://" + vercelUrl.replace(/\/$/, "");
  }

  // Never generate production authentication links pointing to localhost.
  if (process.env.NODE_ENV === "production") {
    return "https://probee-v2.vercel.app";
  }

  return "http://localhost:3000";
}

export function safeNextPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return "/account";
  }

  if (value === "/admin" || value.startsWith("/admin/")) {
    return value;
  }

  if (value === "/account" || value.startsWith("/account/")) {
    return value;
  }

  return "/account";
}

export function getEmailConfirmationUrl(next = "/account"): string {
  const url = new URL("/auth/confirm", getSiteUrl());
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

export function getPasswordRecoveryCallbackUrl(): string {
  const url = new URL("/auth/callback", getSiteUrl());
  url.searchParams.set("next", "/reset-password");
  return url.toString();
}
