import { createClient } from "@/lib/supabase/server";
import type {
  RenderedTransactionalEmail,
  TransactionalEmailRequest,
} from "./types";
import {
  renderDigitalEntitlementReady,
  renderOrderCreated,
  renderPaymentPaid,
  renderPaymentRejected,
  renderPaymentSubmitted,
} from "./templates";
import {
  getEmailProviderStatus,
  sendWithConfiguredProvider,
} from "./provider";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatAmount(amount: number | string, currency: string): string {
  const number = Number(amount);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00 " + currency;
}

function sourceId(request: TransactionalEmailRequest): string {
  switch (request.event) {
    case "order_created":
      return request.orderId;
    case "payment_submitted":
    case "payment_paid":
    case "payment_rejected":
      return request.paymentId;
    case "digital_entitlement_ready":
      return request.entitlementId;
  }
}

function idempotencyKey(request: TransactionalEmailRequest): string {
  return request.event + ":" + sourceId(request);
}

function safeDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently"
    : date.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      });
}

function render(
  request: TransactionalEmailRequest,
  data: Record<string, unknown>,
): RenderedTransactionalEmail {
  if (request.event === "order_created") return renderOrderCreated(data as never);
  if (request.event === "payment_submitted") return renderPaymentSubmitted(data as never);
  if (request.event === "payment_paid") return renderPaymentPaid(data as never);
  if (request.event === "payment_rejected") return renderPaymentRejected(data as never);
  return renderDigitalEntitlementReady(data as never);
}

export async function sendTransactionalEmail(
  request: TransactionalEmailRequest,
): Promise<{ status: "sent" | "queued" | "failed" | "skipped"; reason?: string }> {
  if (!Object.values(request).every((value) => typeof value === "string" && value)) {
    return { status: "failed", reason: "Invalid transactional email request." };
  }

  const relatedId = sourceId(request);

  if (!isUuid(relatedId)) {
    return { status: "failed", reason: "Invalid related entity id." };
  }

  const key = idempotencyKey(request);
  const supabase = await createClient();
  const { data: claim, error: claimError } = await supabase.rpc(
    "claim_transactional_email",
    {
      p_event_type: request.event,
      p_idempotency_key: key,
      p_order_id: request.event === "order_created" ? relatedId : null,
      p_payment_id:
        request.event === "payment_submitted" ||
        request.event === "payment_paid" ||
        request.event === "payment_rejected"
          ? relatedId
          : null,
      p_entitlement_id:
        request.event === "digital_entitlement_ready" ? relatedId : null,
    },
  );

  if (claimError || !claim) {
    console.error(
      "Transactional email claim failed:",
      claimError?.message ?? "unknown",
    );
    return { status: "failed", reason: "EMAIL_CLAIM_FAILED" };
  }

  const claimRecord = claim as Record<string, unknown>;

  if (claimRecord.alreadySent === true) return { status: "sent" };
  if (claimRecord.inProgress === true) return { status: "queued" };
  if (claimRecord.blocked === true) {
    return { status: "failed", reason: "EMAIL_RETRY_LIMIT_REACHED" };
  }

  const emailId = String(claimRecord.emailId ?? "");
  const recipient = String(claimRecord.recipient ?? "");

  if (!isUuid(emailId) || !recipient) {
    return { status: "failed", reason: "EMAIL_CLAIM_INVALID" };
  }

  const providerStatus = getEmailProviderStatus();

  if (!providerStatus.configured) {
    await supabase.rpc("complete_transactional_email", {
      p_email_id: emailId,
      p_status: "failed",
      p_provider: providerStatus.provider,
      p_provider_message_id: null,
      p_error: "EMAIL_PROVIDER_NOT_CONFIGURED",
    });

    return {
      status: "failed",
      reason: providerStatus.reason ?? "EMAIL_PROVIDER_NOT_CONFIGURED",
    };
  }

  try {
    const data = await loadEmailData(request);
    const rendered = render(request, data);
    const result = await sendWithConfiguredProvider({
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      idempotencyKey: key,
    });

    if (!result.ok) {
      await supabase.rpc("complete_transactional_email", {
        p_email_id: emailId,
        p_status: "failed",
        p_provider: result.provider,
        p_provider_message_id: null,
        p_error: result.error ?? "PROVIDER_REQUEST_FAILED",
      });
      return { status: "failed", reason: result.error };
    }

    const { error: completeError } = await supabase.rpc(
      "complete_transactional_email",
      {
        p_email_id: emailId,
        p_status: "sent",
        p_provider: result.provider,
        p_provider_message_id: result.messageId ?? null,
        p_error: null,
      },
    );

    if (completeError) {
      return { status: "failed", reason: "EMAIL_LOG_UPDATE_FAILED" };
    }

    return { status: "sent" };
  } catch {
    await supabase.rpc("complete_transactional_email", {
      p_email_id: emailId,
      p_status: "failed",
      p_provider: providerStatus.provider,
      p_provider_message_id: null,
      p_error: "EMAIL_RENDER_OR_SEND_FAILED",
    });
    return { status: "failed", reason: "EMAIL_RENDER_OR_SEND_FAILED" };
  }
}

async function loadEmailData(
  request: TransactionalEmailRequest,
): Promise<Record<string, unknown>> {
  const supabase = await createClient();

  if (request.event === "order_created") {
    const { data: order } = await supabase
      .from("orders")
      .select(
        "id,order_reference,created_at,total,currency,order_status,payment_status,payment_method",
      )
      .eq("id", request.orderId)
      .maybeSingle();

    if (!order) throw new Error("Order not found");

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name_snapshot,plan_name_snapshot,quantity,line_total")
      .eq("order_id", request.orderId)
      .order("created_at", { ascending: true });

    return {
      orderReference: order.order_reference,
      orderDate: safeDate(order.created_at),
      total: formatAmount(order.total, order.currency),
      currency: order.currency,
      orderStatus: order.order_status,
      paymentMethod: order.payment_method,
      paymentRequired: order.payment_status !== "paid",
      items: (items ?? []).map((item) => ({
        name: item.product_name_snapshot,
        plan: item.plan_name_snapshot,
        quantity: item.quantity,
        lineTotal: formatAmount(item.line_total, order.currency),
      })),
    };
  }

  if (
    request.event === "payment_submitted" ||
    request.event === "payment_paid" ||
    request.event === "payment_rejected"
  ) {
    const { data: payment } = await supabase
      .from("payments")
      .select("id,order_id,external_reference,amount,currency")
      .eq("id", request.paymentId)
      .maybeSingle();

    if (!payment) throw new Error("Payment not found");

    const { data: order } = await supabase
      .from("orders")
      .select("order_reference")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (!order) throw new Error("Order not found");

    return {
      orderReference: order.order_reference,
      paymentReference: payment.external_reference,
      amount: formatAmount(payment.amount, payment.currency),
      currency: payment.currency,
    };
  }

  const { data: entitlement } = await supabase
    .from("digital_entitlements")
    .select("id,order_id,order_item_id,access_status,delivery_instructions")
    .eq("id", request.entitlementId)
    .maybeSingle();

  if (!entitlement) throw new Error("Entitlement not found");

  const [{ data: order }, { data: item }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_reference")
      .eq("id", entitlement.order_id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("product_name_snapshot,plan_name_snapshot")
      .eq("id", entitlement.order_item_id)
      .maybeSingle(),
  ]);

  if (!order || !item) throw new Error("Digital fulfillment data not found");

  return {
    productName: item.product_name_snapshot,
    planName: item.plan_name_snapshot,
    accessStatus: entitlement.access_status,
    instructions: entitlement.delivery_instructions,
    orderReference: order.order_reference,
  };
}
