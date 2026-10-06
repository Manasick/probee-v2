export type DurationUnit =
  | "day"
  | "week"
  | "month"
  | "year"
  | "lifetime"
  | string;

export type ProductMediaType = "image" | "video" | "other";

export interface ProductMedia {
  id: string;
  url: string;
  storagePath?: string;
  alt?: string;
  title?: string;
  caption?: string;
  kind?: ProductMediaType;
  sortOrder?: number;
  isPrimary?: boolean;
  active?: boolean;
}

export interface AdminProductMedia extends ProductMedia {
  storagePath: string;
  active: boolean;
  sortOrder: number;
  isPrimary: boolean;
  mimeType: string;
}

export interface ProductPlan {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  billingType?: "one_time" | "subscription" | string;
  billingInterval?: "day" | "week" | "month" | "year" | string;
  billingIntervalCount?: number;
  price: number;
  currency: string;
  duration?: number;
  durationUnit?: DurationUnit;
  renewalAvailable?: boolean;
  warrantyPeriod?: number;
  warrantyUnit?: DurationUnit;
  seats?: number;
  invites?: number;
  participants?: number;
  features?: string[];
  deliveryType?: string;
  deliveryDetails?: string;
  requiresCustomerEmail?: boolean;
  customerRequirements?: unknown[];
  customAttributes?: Record<string, unknown>;
  active?: boolean;
  sortOrder?: number;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  active?: boolean;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  fullDescription?: string;
  coverUrl?: string;
  productType?: string;
  active: boolean;
  published: boolean;
  featured?: boolean;
  sortOrder?: number;
  warrantyPeriod?: number;
  warrantyUnit?: DurationUnit;
  delivery?: {
    type?: string;
    label?: string;
    description?: string;
  };
  requiresCustomerEmail?: boolean;
  customerRequirements?: unknown[];
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  category?: CatalogCategory;
  media?: ProductMedia[];
  features?: string[];
  packageInclusions?: string[];
  plans: ProductPlan[];
  customAttributes?: Record<string, unknown>;
}

export interface AdminKeyValue {
  id: string;
  key: string;
  value: string;
}

export interface AdminFeatureItem {
  id: string;
  text: string;
  active: boolean;
  sortOrder: number;
}

export interface AdminProductPlanInput {
  id?: string;
  name: string;
  slug: string;
  description: string;
  billingType: "one_time" | "subscription";
  billingInterval: "" | "day" | "week" | "month" | "year";
  billingIntervalCount: number | null;
  price: number;
  currency: string;
  duration: number | null;
  durationUnit: "" | "day" | "week" | "month" | "year" | "lifetime";
  renewalAvailable: boolean;
  warrantyDuration: number | null;
  warrantyUnit: "" | "day" | "week" | "month" | "year" | "lifetime";
  seats: number | null;
  invites: number | null;
  participants: number | null;
  features: string[];
  deliveryType: string;
  deliveryDetails: string;
  requiresCustomerEmail: boolean;
  customerRequirements: string[];
  customAttributes: Record<string, string>;
  active: boolean;
  sortOrder: number;
}

export interface AdminProductInput {
  id?: string;
  name: string;
  slug: string;
  productType: "digital" | "license" | "subscription";
  shortDescription: string;
  fullDescription: string;
  active: boolean;
  published: boolean;
  featured: boolean;
  sortOrder: number;
  categoryIds: string[];
  warrantyDuration: number | null;
  warrantyUnit: "" | "day" | "week" | "month" | "year" | "lifetime";
  deliveryType: string;
  deliveryDetails: string;
  requiresCustomerEmail: boolean;
  customerRequirements: string[];
  customAttributes: Record<string, string>;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  features: AdminFeatureItem[];
  packageInclusions: AdminFeatureItem[];
  plans: AdminProductPlanInput[];
  media: AdminProductMedia[];
}

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string;
  productType: string;
  active: boolean;
  published: boolean;
  featured: boolean;
  sortOrder: number;
  updatedAt: string;
  categories: Pick<CatalogCategory, "id" | "name" | "slug">[];
  planCount: number;
  priceRange: {
    min: number;
    max: number;
    currency: string;
  } | null;
}
