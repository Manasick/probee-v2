export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "hidden";

export type ReviewSort = "newest" | "highest" | "lowest";

export interface ProductReviewSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface ProductReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  displayName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface ProductReviewPage {
  items: ProductReview[];
  totalCount: number;
  limit: number;
  offset: number;
  sort: ReviewSort;
}

export interface CustomerReview {
  id: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleReviewProduct {
  productId: string;
  productName: string;
  productSlug: string | null;
  orderReference: string;
}

export interface ReviewDashboard {
  reviews: CustomerReview[];
  eligibleProducts: EligibleReviewProduct[];
}

export interface AdminReview {
  id: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  reviewerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  moderatedAt: string | null;
  moderationReason: string | null;
}
