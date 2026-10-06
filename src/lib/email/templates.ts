import type { RenderedTransactionalEmail } from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function siteUrl(path: string): string {
  try {
    const base = new URL(SITE_URL);
    if (base.protocol !== "https:" && base.hostname !== "localhost") {
      throw new Error("Invalid site URL");
    }
    return new URL(path, base).toString();
  } catch {
    return "http://localhost:3000" + path;
  }
}

function layout(
  subject: string,
  preheader: string,
  content: string,
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(subject)}</title>
<style>
body{margin:0;background:#080808;color:#f4f1e8;font-family:Arial,Helvetica,sans-serif}
.container{max-width:600px;margin:0 auto;padding:32px 18px}
.card{background:#121212;border:1px solid #292929;border-radius:14px;padding:28px}
.brand{color:#d6ad60;font-size:24px;font-weight:700;letter-spacing:.04em}
.muted{color:#aaa;line-height:1.65}
.title{font-size:26px;line-height:1.25;margin:22px 0 12px}
.button{display:inline-block;background:#d6ad60;color:#080808!important;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700}
.meta{border-top:1px solid #292929;margin-top:22px;padding-top:18px}
.footer{color:#777;font-size:12px;line-height:1.6;padding:18px 4px}
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<div class="container">
<div class="card">
<div class="brand">ProBee</div>
${content}
</div>
<div class="footer">This is a transactional message related to your ProBee account or purchase. It is not a marketing email.</div>
</div>
</body>
</html>`;
}

function button(label: string, href: string): string {
  return `<p><a class="button" href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`;
}

export function renderOrderCreated(input: {
  orderReference: string;
  orderDate: string;
  total: string;
  currency: string;
  orderStatus: string;
  paymentMethod: string | null;
  items: Array<{ name: string; plan: string | null; quantity: number; lineTotal: string }>;
  paymentRequired: boolean;
}): RenderedTransactionalEmail {
  const subject = `ProBee order ${input.orderReference} received`;
  const itemRows = input.items.map((item) =>
    `<tr><td style="padding:8px 0">${escapeHtml(item.name)}${item.plan ? `<br><span class="muted">${escapeHtml(item.plan)}</span>` : ""}</td><td style="padding:8px 0;text-align:right">${escapeHtml(item.quantity)} × ${escapeHtml(item.lineTotal)} ${escapeHtml(input.currency)}</td></tr>`,
  ).join("");
  const paymentNote = input.paymentRequired
    ? "<p class=\"muted\">Payment is still pending. If manual bank transfer is enabled for your order, use the payment page in your account to continue.</p>"
    : `<p class="muted">Payment method: ${escapeHtml(input.paymentMethod ?? "Not specified")}.</p>`;
  const html = layout(subject, "Your ProBee order was received.", `
<h1 class="title">Order received</h1>
<p class="muted">Thanks for choosing ProBee. Your order <strong>${escapeHtml(input.orderReference)}</strong> was created successfully.</p>
<div class="meta">
<p><strong>Order status:</strong> ${escapeHtml(input.orderStatus)}</p>
<p><strong>Total:</strong> ${escapeHtml(input.total)} ${escapeHtml(input.currency)}</p>
<p><strong>Placed:</strong> ${escapeHtml(input.orderDate)}</p>
</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">${itemRows}</table>
${paymentNote}
${button("View your order", siteUrl("/account/orders/" + encodeURIComponent(input.orderReference)))}
`);
  return { subject, html, preheader: "Your ProBee order was received." };
}

export function renderPaymentSubmitted(input: {
  orderReference: string;
  paymentReference: string | null;
  amount: string;
  currency: string;
}): RenderedTransactionalEmail {
  const subject = `Payment submitted for ${input.orderReference}`;
  const html = layout(subject, "Your payment proof is pending verification.", `
<h1 class="title">Payment submitted</h1>
<p class="muted">We received your manual bank-transfer payment submission for <strong>${escapeHtml(input.orderReference)}</strong>.</p>
<div class="meta">
<p><strong>Amount:</strong> ${escapeHtml(input.amount)} ${escapeHtml(input.currency)}</p>
<p><strong>Payment reference:</strong> ${escapeHtml(input.paymentReference ?? "Not provided")}</p>
<p><strong>Status:</strong> Pending verification</p>
</div>
<p class="muted">Our team will review the submitted proof. This message does not mean the payment has been verified.</p>
${button("View payment status", siteUrl("/account/orders/" + encodeURIComponent(input.orderReference)))}
`);
  return { subject, html, preheader: "Your payment submission is pending verification." };
}

export function renderPaymentPaid(input: {
  orderReference: string;
  amount: string;
  currency: string;
}): RenderedTransactionalEmail {
  const subject = `Payment verified for ${input.orderReference}`;
  const html = layout(subject, "Your ProBee payment has been verified.", `
<h1 class="title">Payment verified</h1>
<p class="muted">Your payment for <strong>${escapeHtml(input.orderReference)}</strong> has been verified.</p>
<div class="meta"><p><strong>Amount:</strong> ${escapeHtml(input.amount)} ${escapeHtml(input.currency)}</p><p><strong>Status:</strong> Paid</p></div>
<p class="muted">Your order can now continue through the fulfillment process. Digital access is only available after fulfillment is completed.</p>
${button("View your order", siteUrl("/account/orders/" + encodeURIComponent(input.orderReference)))}
`);
  return { subject, html, preheader: "Your ProBee payment has been verified." };
}

export function renderPaymentRejected(input: {
  orderReference: string;
  amount: string;
  currency: string;
}): RenderedTransactionalEmail {
  const subject = `Payment review needed for ${input.orderReference}`;
  const html = layout(subject, "Your payment submission needs another review.", `
<h1 class="title">Payment needs attention</h1>
<p class="muted">We could not verify the payment submission for <strong>${escapeHtml(input.orderReference)}</strong>.</p>
<div class="meta"><p><strong>Amount:</strong> ${escapeHtml(input.amount)} ${escapeHtml(input.currency)}</p><p><strong>Status:</strong> Rejected</p></div>
<p class="muted">If the order is still eligible, you can return to the payment flow and submit the correct payment reference and proof.</p>
${button("Review payment", siteUrl("/account/orders/" + encodeURIComponent(input.orderReference)))}
`);
  return { subject, html, preheader: "Your payment submission needs another review." };
}

export function renderDigitalEntitlementReady(input: {
  productName: string;
  planName: string | null;
  accessStatus: string;
  instructions: string | null;
  orderReference: string;
}): RenderedTransactionalEmail {
  const subject = `Your ProBee digital access is ready`;
  const instructions = input.instructions
    ? `<div class="meta"><p><strong>Instructions</strong></p><p class="muted">${escapeHtml(input.instructions).replaceAll("\n", "<br>")}</p></div>`
    : "";
  const html = layout(subject, "Your ProBee digital entitlement is ready.", `
<h1 class="title">Digital access is ready</h1>
<p class="muted">Your fulfilled digital product is now available in your authenticated ProBee account.</p>
<div class="meta">
<p><strong>Product:</strong> ${escapeHtml(input.productName)}</p>
<p><strong>Plan:</strong> ${escapeHtml(input.planName ?? "Standard")}</p>
<p><strong>Status:</strong> ${escapeHtml(input.accessStatus)}</p>
<p><strong>Order:</strong> ${escapeHtml(input.orderReference)}</p>
</div>
${instructions}
${button("Open digital products", siteUrl("/account/digital-products"))}
`);
  return { subject, html, preheader: "Your ProBee digital entitlement is ready." };
}

export function renderAccountActivation(): RenderedTransactionalEmail {
  const subject = "Activate your ProBee account";
  const html = layout(subject, "Confirm your ProBee email address.", `
<h1 class="title">Activate your account</h1>
<p class="muted">Confirm your email address using the secure link provided by Supabase Auth.</p>
<p class="muted">ProBee does not create or store custom activation tokens. Configure the Supabase Auth confirmation email template to use your branded ProBee presentation and existing confirmation callback.</p>
`);
  return { subject, html, preheader: "Confirm your ProBee email address." };
}

export function renderPasswordReset(): RenderedTransactionalEmail {
  const subject = "Reset your ProBee password";
  const html = layout(subject, "Use the secure Supabase Auth recovery flow.", `
<h1 class="title">Password recovery</h1>
<p class="muted">Use the secure password-recovery link provided by Supabase Auth. ProBee does not create or store custom reset tokens.</p>
`);
  return { subject, html, preheader: "Use the secure ProBee password-recovery flow." };
}
