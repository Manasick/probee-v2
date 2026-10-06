import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseImagePattern = (() => {
  if (!supabaseUrl) return null;

  try {
    const parsed = new URL(supabaseUrl);
    return {
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
      pathname: "/**",
    } as const;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: supabaseImagePattern
    ? { remotePatterns: [supabaseImagePattern] }
    : undefined,
};

export default nextConfig;
