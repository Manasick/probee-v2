export interface DigitalAssetSummary {
  id: string;
  title: string;
  description: string | null;
  mimeType: string;
  fileSizeBytes: number;
  customerInstructions: string | null;
}

export interface DigitalEntitlement {
  id: string;
  orderReference: string;
  orderItemId: string;
  productName: string;
  planName: string | null;
  accessStatus: string;
  deliveryType: string | null;
  deliveryInstructions: string | null;
  customerAccessUrl: string | null;
  grantedAt: string;
  fulfilledAt: string | null;
  expiresAt: string | null;
  orderStatus: string;
  paymentStatus: string;
  accessAllowed: boolean;
  assets: DigitalAssetSummary[];
}