import { createClient } from "@/lib/supabase/server";
import type { DigitalEntitlement } from "@/lib/digital-delivery/types";

function parseEntitlements(value: unknown): DigitalEntitlement[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => {
      return typeof item === "object" && item !== null && !Array.isArray(item);
    })
    .map((item) => ({
      id: String(item.id ?? ""),
      orderReference: String(item.orderReference ?? ""),
      orderItemId: String(item.orderItemId ?? ""),
      productName: String(item.productName ?? "Digital product"),
      planName: typeof item.planName === "string" ? item.planName : null,
      accessStatus: String(item.accessStatus ?? "revoked"),
      deliveryType: typeof item.deliveryType === "string" ? item.deliveryType : null,
      deliveryInstructions:
        typeof item.deliveryInstructions === "string"
          ? item.deliveryInstructions
          : null,
      customerAccessUrl:
        typeof item.customerAccessUrl === "string"
          ? item.customerAccessUrl
          : null,
      grantedAt: String(item.grantedAt ?? ""),
      fulfilledAt: typeof item.fulfilledAt === "string" ? item.fulfilledAt : null,
      expiresAt: typeof item.expiresAt === "string" ? item.expiresAt : null,
      orderStatus: String(item.orderStatus ?? "pending"),
      paymentStatus: String(item.paymentStatus ?? "pending"),
      accessAllowed: Boolean(item.accessAllowed),
      assets: Array.isArray(item.assets)
        ? item.assets
            .filter(
              (asset): asset is Record<string, unknown> =>
                typeof asset === "object" &&
                asset !== null &&
                !Array.isArray(asset),
            )
            .map((asset) => ({
              id: String(asset.id ?? ""),
              title: String(asset.title ?? "Digital file"),
              description:
                typeof asset.description === "string"
                  ? asset.description
                  : null,
              mimeType: String(asset.mimeType ?? "application/octet-stream"),
              fileSizeBytes: Number(asset.fileSizeBytes ?? 0),
              customerInstructions:
                typeof asset.customerInstructions === "string"
                  ? asset.customerInstructions
                  : null,
            }))
        : [],
    }))
    .filter((item) => Boolean(item.id && item.orderItemId));
}

export async function getMyDigitalEntitlements(): Promise<{
  entitlements: DigitalEntitlement[];
  error: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_digital_entitlements");

  if (error) return { entitlements: [], error: true };

  return { entitlements: parseEntitlements(data), error: false };
}