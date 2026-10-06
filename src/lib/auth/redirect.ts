export function getSafeNextPath(
  value: string | null | undefined,
  fallback = "/account",
): string {
  if (!value) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function getBrowserAuthRedirect(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}
