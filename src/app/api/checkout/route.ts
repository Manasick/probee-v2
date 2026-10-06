import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KNOWN_CHECKOUT_ERRORS: Record<string, { status: number; message: string }> = {
  "checkout:auth_required": {
    status: 401,
    message: "Please sign in before placing an order.",
  },
  "checkout:cart_empty": {
    status: 400,
    message: "Your cart is empty.",
  },
  "checkout:items_invalid": {
    status: 400,
    message: "Your cart could not be validated. Please return to the cart and try again.",
  },
  "checkout:item_invalid": {
    status: 400,
    message: "One or more cart items are invalid. Please refresh your cart and try again.",
  },
  "checkout:quantity_invalid": {
    status: 400,
    message: "One or more quantities are invalid. Please review your cart.",
  },
  "checkout:too_many_lines": {
    status: 400,
    message: "Your cart contains too many line items.",
  },
  "checkout:customer_invalid": {
    status: 400,
    message: "Please review the customer information and try again.",
  },
  "checkout:idempotency_invalid": {
    status: 400,
    message: "The checkout request could not be validated. Please try again.",
  },
  "checkout:catalog_unavailable": {
    status: 409,
    message: "One or more products or plans are no longer available. Please refresh your cart.",
  },
  "checkout:currency_mismatch": {
    status: 409,
    message: "Your cart contains different currencies. Please place separate orders.",
  },
  "checkout:total_too_large": {
    status: 400,
    message: "The order total is outside the supported range.",
  },
  "checkout:email_unavailable": {
    status: 400,
    message: "Your account email could not be validated. Please sign in again.",
  },
  "checkout:idempotency_conflict": {
    status: 409,
    message: "This checkout request is already being processed. Please try again.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCartItem(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.productId === "string" &&
    UUID_PATTERN.test(value.productId) &&
    typeof value.planId === "string" &&
    UUID_PATTERN.test(value.planId) &&
    typeof value.quantity === "number" &&
    Number.isInteger(value.quantity) &&
    value.quantity >= 1 &&
    value.quantity <= 99
  );
}

function isUuid(value: string | null): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in before placing an order." },
      { status: 401 },
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!isUuid(idempotencyKey)) {
    return NextResponse.json(
      { error: "The checkout request could not be validated. Please try again." },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid checkout request." },
      { status: 400 },
    );
  }

  if (!isRecord(body) || !Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "Invalid checkout request." },
      { status: 400 },
    );
  }

  if (body.items.length === 0) {
    return NextResponse.json(
      { error: "Your cart is empty." },
      { status: 400 },
    );
  }

  if (body.items.length > 50 || !body.items.every(isCartItem)) {
    return NextResponse.json(
      { error: "Your cart could not be validated. Please return to the cart and try again." },
      { status: 400 },
    );
  }

  if (
    (body.customerName !== undefined &&
      body.customerName !== null &&
      typeof body.customerName !== "string") ||
    (body.customerPhone !== undefined &&
      body.customerPhone !== null &&
      typeof body.customerPhone !== "string")
  ) {
    return NextResponse.json(
      { error: "Please review the customer information and try again." },
      { status: 400 },
    );
  }

  const customerName =
    body.customerName === undefined || body.customerName === null
      ? null
      : body.customerName;

  const customerPhone =
    body.customerPhone === undefined || body.customerPhone === null
      ? null
      : body.customerPhone;

  if (
    (customerName !== null && customerName.length > 200) ||
    (customerPhone !== null && customerPhone.length > 50)
  ) {
    return NextResponse.json(
      { error: "Please review the customer information and try again." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("create_checkout_order", {
    p_items: body.items,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !data || typeof data !== "object") {
    const known = error ? KNOWN_CHECKOUT_ERRORS[error.message] : undefined;

    if (known) {
      return NextResponse.json({ error: known.message }, { status: known.status });
    }

    return NextResponse.json(
      { error: "We could not create your order. No changes were made to your cart." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(data, {
    status: 201,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
