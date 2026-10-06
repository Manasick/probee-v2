export type DurationUnit =
  | "day"
  | "week"
  | "month"
  | "year"
  | "lifetime"
  | string;

export interface ProductMedia {
  id: string;
  url: string;
  alt?: string;
  kind?: "image" | "video";
  sortOrder?: number;
}

export interface ProductPlan {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  durationUnit?: DurationUnit;
  price: number;
  currency: string;
  renewalAvailable?: boolean;
  warrantyPeriod?: number;
  warrantyUnit?: DurationUnit;
  seats?: number;
  invites?: number;
  participants?: number;
  features?: string[];
  deliveryType?: string;
  requiresCustomerEmail?: boolean;
  customAttributes?: Record<string, unknown>;
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  active?: boolean;
  sortOrder?: number;
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
  category?: CatalogCategory;
  media?: ProductMedia[];
  features?: string[];
  packageInclusions?: string[];
  plans: ProductPlan[];
  delivery?: {
    type?: string;
    label?: string;
    description?: string;
  };
  customerRequirements?: string[];
  customAttributes?: Record<string, unknown>;
}
