import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/urls";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const supabase = await createClient();

  if (
    tokenHash &&
    (type === "email" || type === "signup")
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=verification_failed", request.url),
      );
    }

    return NextResponse.redirect(
      new URL(next + "?verified=1", request.url),
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL("/login?error=verification_failed", request.url),
      );
    }

    return NextResponse.redirect(
      new URL(next + "?verified=1", request.url),
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=verification_failed", request.url),
  );
}
