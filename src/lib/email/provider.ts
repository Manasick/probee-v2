interface ProviderResult {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

function getConfig() {
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  return { provider, apiKey, from, replyTo };
}

export function getEmailProviderStatus(): {
  provider: string | null;
  configured: boolean;
  reason: string | null;
} {
  const { provider, apiKey, from } = getConfig();

  if (!provider || provider === "none") {
    return { provider: null, configured: false, reason: "No provider configured." };
  }

  if (provider !== "resend") {
    return { provider, configured: false, reason: "Unsupported provider." };
  }

  if (!apiKey || !from) {
    return {
      provider,
      configured: false,
      reason: "EMAIL_API_KEY and EMAIL_FROM are required.",
    };
  }

  return { provider, configured: true, reason: null };
}

export async function sendWithConfiguredProvider(input: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<ProviderResult> {
  const { provider, apiKey, from, replyTo } = getConfig();

  if (provider !== "resend" || !apiKey || !from) {
    return {
      ok: false,
      provider: provider || "none",
      error: "EMAIL_PROVIDER_NOT_CONFIGURED",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | { id?: unknown; name?: unknown }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        provider: "resend",
        error:
          typeof data?.name === "string"
            ? data.name.slice(0, 160)
            : "PROVIDER_HTTP_" + response.status,
      };
    }

    return {
      ok: true,
      provider: "resend",
      messageId: typeof data?.id === "string" ? data.id : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "resend",
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "PROVIDER_TIMEOUT"
          : "PROVIDER_NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timeout);
  }
}
