import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeError(errorMessage: string): string {
  if (errorMessage === "digital:access_denied") {
    return "This digital access is no longer available.";
  }
  if (errorMessage === "digital:asset_not_found") {
    return "The requested digital file could not be found.";
  }
  return "The digital file could not be accessed.";
}

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      entitlementId: string;
      assetId: string;
    }>;
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to access this digital file." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { entitlementId, assetId } = await params;

  const { data: storagePath, error: pathError } = await supabase.rpc(
    "get_my_digital_asset_path",
    {
      p_entitlement_id: entitlementId,
      p_asset_id: assetId,
    },
  );

  if (pathError || typeof storagePath !== "string") {
    return NextResponse.json(
      { error: safeError(pathError?.message ?? "digital:access_denied") },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("digital-products")
    .createSignedUrl(storagePath, 60);

  if (signedUrlError || !signedUrl?.signedUrl) {
    return NextResponse.json(
      { error: "The digital file could not be accessed right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(signedUrl.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}