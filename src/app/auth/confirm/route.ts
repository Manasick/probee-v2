import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/urls";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<EmailOtpType>(["email", "recovery"]);

function redirectFailure(request: NextRequest) {
  return NextResponse.redirect(
    new URL("/login?error=verification_failed", request.url),
  );
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const typeParam = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const type = typeParam as EmailOtpType | null;

  const defaultNext = type === "recovery" ? "/reset-password" : "/account";
  const next = safeNextPath(
    request.nextUrl.searchParams.get("next"),
    defaultNext,
  );

  const supabase = await createClient();

  if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      return redirectFailure(request);
    }

    const redirectUrl = new URL(next, request.url);
    redirectUrl.searchParams.set("verified", "1");
    redirectUrl.searchParams.delete("token_hash");
    redirectUrl.searchParams.delete("type");
    redirectUrl.searchParams.delete("next");

    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectFailure(request);
    }

    const redirectUrl = new URL(next, request.url);
    redirectUrl.searchParams.delete("code");
    redirectUrl.searchParams.delete("next");

    return NextResponse.redirect(redirectUrl);
  }

  return redirectFailure(request);
}
