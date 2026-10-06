import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  hasAllowedPaymentMimeType,
  PAYMENT_PROOF_EXTENSIONS,
  PAYMENT_PROOF_MAX_BYTES,
  PAYMENT_REFERENCE_MAX_LENGTH,
  sanitizePaymentFilename,
} from "@/lib/payments/validation";

const ERRORS: Record<string, { status: number; message: string }> = {
  "payment:auth_required": {
    status: 401,
    message: "Please sign in before submitting payment.",
  },
  "payment:order_invalid": {
    status: 400,
    message: "The order reference is invalid.",
  },
  "payment:order_not_found": {
    status: 404,
    message: "That order could not be found for your account.",
  },
  "payment:order_ineligible": {
    status: 409,
    message: "This order is no longer eligible for manual payment.",
  },
  "payment:already_paid": {
    status: 409,
    message: "This order is already marked as paid.",
  },
  "payment:not_required": {
    status: 400,
    message: "This order does not require a manual payment.",
  },
  "payment:method_unavailable": {
    status: 409,
    message: "Manual bank transfer is currently unavailable.",
  },
  "payment:reference_invalid": {
    status: 400,
    message: "Enter a valid payment reference or transaction ID.",
  },
  "payment:file_invalid": {
    status: 400,
    message: "Upload a valid JPG, PNG, WebP, or PDF payment proof up to 10 MB.",
  },
  "payment:not_authorized": {
    status: 403,
    message: "You are not authorized to perform this payment operation.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type PaymentProofExtension = "jpg" | "png" | "webp" | "pdf";

function signatureMatches(bytes: Uint8Array): PaymentProofExtension | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }

  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "webp";
  }

  if (
    bytes.length >= 5 &&
    String.fromCharCode(
      bytes[0],
      bytes[1],
      bytes[2],
      bytes[3],
      bytes[4],
    ) === "%PDF-"
  ) {
    return "pdf";
  }

  return null;
}

function mimeFromExtension(
  extension: PaymentProofExtension,
): keyof typeof PAYMENT_PROOF_EXTENSIONS {
  const entry = Object.entries(PAYMENT_PROOF_EXTENSIONS).find(
    ([, value]) => value === extension,
  );

  return entry?.[0] as keyof typeof PAYMENT_PROOF_EXTENSIONS;
}

async function mapRpcError(
  error: { message?: string | null } | null,
): Promise<{ status: number; message: string }> {
  const key = error?.message ?? "";
  return ERRORS[key] ?? {
    status: 500,
    message:
      "We could not submit the payment proof. No payment status was changed.",
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in before submitting payment." },
      { status: 401 },
    );
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "The payment submission could not be read." },
      { status: 400 },
    );
  }

  const orderReferenceValue = form.get("orderReference");
  const paymentReferenceValue = form.get("paymentReference");
  const fileValue = form.get("proof");

  if (
    typeof orderReferenceValue !== "string" ||
    typeof paymentReferenceValue !== "string" ||
    !(fileValue instanceof File)
  ) {
    return NextResponse.json(
      { error: "Payment reference and proof are required." },
      { status: 400 },
    );
  }

  const orderReference = orderReferenceValue.trim();
  const paymentReference = paymentReferenceValue.trim();

  if (!orderReference || orderReference.length > 64) {
    return NextResponse.json(
      { error: "The order reference is invalid." },
      { status: 400 },
    );
  }

  if (
    paymentReference.length < 2 ||
    paymentReference.length > PAYMENT_REFERENCE_MAX_LENGTH
  ) {
    return NextResponse.json(
      { error: "Enter a valid payment reference or transaction ID." },
      { status: 400 },
    );
  }

  if (fileValue.size <= 0 || fileValue.size > PAYMENT_PROOF_MAX_BYTES) {
    return NextResponse.json(
      { error: "Upload a valid JPG, PNG, WebP, or PDF payment proof up to 10 MB." },
      { status: 400 },
    );
  }

  if (fileValue.type && !hasAllowedPaymentMimeType(fileValue.type)) {
    return NextResponse.json(
      { error: "Upload a valid JPG, PNG, WebP, or PDF payment proof up to 10 MB." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await fileValue.arrayBuffer());
  const extension = signatureMatches(bytes);

  if (!extension) {
    return NextResponse.json(
      { error: "The uploaded file could not be verified as a supported proof type." },
      { status: 400 },
    );
  }

  const detectedMimeType = mimeFromExtension(extension);

  if (!detectedMimeType) {
    return NextResponse.json(
      { error: "The uploaded file type could not be determined." },
      { status: 400 },
    );
  }

  const fileSha256 = createHash("sha256").update(bytes).digest("hex");
  const proofId = randomUUID();
  const safePath = `payment-proofs/pending/${proofId}.${extension}`;

  // The final database function requires the order id in the path, so resolve
  // the owned order first without trusting any client-supplied payment id.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_reference")
    .eq("order_reference", orderReference)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "That order could not be found for your account." },
      { status: 404 },
    );
  }

  const { data: activeSettings } = await supabase
    .from("payment_settings")
    .select("enabled")
    .eq("payment_method", "manual_bank_transfer")
    .eq("enabled", true)
    .maybeSingle();

  if (!activeSettings?.enabled) {
    return NextResponse.json(
      { error: "Manual bank transfer is currently unavailable." },
      { status: 409 },
    );
  }

  const finalPath = `payment-proofs/${order.id}/${proofId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(finalPath, bytes, {
      contentType: detectedMimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "The payment proof could not be uploaded. Please try again." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase.rpc("submit_manual_bank_payment", {
    p_order_reference: orderReference,
    p_external_reference: paymentReference,
    p_storage_path: finalPath,
    p_original_filename: sanitizePaymentFilename(fileValue.name),
    p_mime_type: detectedMimeType,
    p_file_size_bytes: fileValue.size,
    p_file_sha256: fileSha256,
  });

  if (error || !data || !isRecord(data)) {
    await supabase.storage.from("payment-proofs").remove([finalPath]);

    const mapped = await mapRpcError(error);

    return NextResponse.json(
      { error: mapped.message },
      {
        status: mapped.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (data.createdProof === false) {
    await supabase.storage.from("payment-proofs").remove([finalPath]);
  }

  return NextResponse.json(
    {
      paymentId: data.paymentId,
      proofId: data.proofId,
      paymentStatus: data.paymentStatus,
      verificationStatus: data.verificationStatus,
      amount: data.amount,
      currency: data.currency,
    },
    {
      status: data.createdProof === false ? 200 : 201,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
