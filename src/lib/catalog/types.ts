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
  alt?: string;
  title?: string;
  caption?: string;
  kind?: ProductMediaType;
  sortOrder?: number;
  isPrimary?: boolean;
  active?: boolean;
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
