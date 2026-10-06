import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import type {
  AdminReview,
  CustomerReview,
  EligibleReviewProduct,
  ProductReview,
  ProductReviewPage,
  ProductReviewSummary,
  ReviewDashboard,
  ReviewSort,
  ReviewStatus,
} from "@/lib/reviews/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSummary(value: unknown): ProductReviewSummary {
  const record = isRecord(value) ? value : {};
  const distribution = isRecord(record.distribution)
    ? record.distribution
    : {};

  return {
    averageRating: Number(record.averageRating ?? 0),
    reviewCount: Number(record.reviewCount ?? 0),
    distribution: {
      "1": Number(distribution["1"] ?? 0),
      "2": Number(distribution["2"] ?? 0),
      "3": Number(distribution["3"] ?? 0),
      "4": Number(distribution["4"] ?? 0),
      "5": Number(distribution["5"] ?? 0),
    },
  };
}

function parseReview(value: unknown): ProductReview | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  return {
    id: value.id,
    rating: Number(value.rating ?? 0),
    title: typeof value.title === "string" ? value.title : null,
    body: typeof value.body === "string" ? value.body : "",
    displayName:
      typeof value.displayName === "string"
        ? value.displayName
        : "ProBee customer",
    isVerifiedPurchase: value.isVerifiedPurchase === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
  };
}

function parseCustomerReview(value: unknown): CustomerReview | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const status = value.status;
  if (
    status !== "pending" &&
    status !== "approved" &&
    status !== "rejected" &&
    status !== "hidden"
  ) {
    return null;
  }

  return {
    id: value.id,
    productId: typeof value.productId === "string" ? value.productId : "",
    productName:
      typeof value.productName === "string"
        ? value.productName
        : "Purchased product",
    productSlug:
      typeof value.productSlug === "string" ? value.productSlug : null,
    rating: Number(value.rating ?? 0),
    title: typeof value.title === "string" ? value.title : null,
    body: typeof value.body === "string" ? value.body : "",
    status,
    isVerifiedPurchase: value.isVerifiedPurchase === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

function parseEligibleProduct(value: unknown): EligibleReviewProduct | null {
  if (!isRecord(value) || typeof value.productId !== "string") return null;

  return {
    productId: value.productId,
    productName:
      typeof value.productName === "string"
        ? value.productName
        : "Purchased product",
    productSlug:
      typeof value.productSlug === "string" ? value.productSlug : null,
    orderReference:
      typeof value.orderReference === "string" ? value.orderReference : "",
  };
}

export async function getProductReviewSummary(
  productId: string,
): Promise<ProductReviewSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_review_summary", {
    p_product_id: productId,
  });

  if (error) {
    return {
      averageRating: 0,
      reviewCount: 0,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    };
  }

  return parseSummary(data);
}

export async function getProductReviews(
  productId: string,
  options: {
    limit: number;
    page: number;
    sort: ReviewSort;
  },
): Promise<ProductReviewPage> {
  const safeLimit = Math.max(1, Math.min(options.limit, 20));
  const safePage = Math.max(1, Math.min(options.page, 1000));
  const offset = (safePage - 1) * safeLimit;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_reviews", {
    p_product_id: productId,
    p_limit: safeLimit,
    p_offset: offset,
    p_sort: options.sort,
  });

  if (error || !isRecord(data)) {
    return {
      items: [],
      totalCount: 0,
      limit: safeLimit,
      offset,
      sort: options.sort,
    };
  }

  const itemsValue = Array.isArray(data.items) ? data.items : [];

  return {
    items: itemsValue
      .map(parseReview)
      .filter((item): item is ProductReview => Boolean(item)),
    totalCount: Number(data.totalCount ?? 0),
    limit: Number(data.limit ?? safeLimit),
    offset: Number(data.offset ?? offset),
    sort:
      data.sort === "highest" || data.sort === "lowest"
        ? data.sort
        : "newest",
  };
}

export async function getMyReviewDashboard(): Promise<ReviewDashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_review_dashboard", {
    p_limit: 100,
  });

  if (error || !isRecord(data)) {
    return { reviews: [], eligibleProducts: [] };
  }

  return {
    reviews: (Array.isArray(data.reviews) ? data.reviews : [])
      .map(parseCustomerReview)
      .filter((item): item is CustomerReview => Boolean(item)),
    eligibleProducts: (Array.isArray(data.eligibleProducts)
      ? data.eligibleProducts
      : []
    )
      .map(parseEligibleProduct)
      .filter((item): item is EligibleReviewProduct => Boolean(item)),
  };
}

function parseAdminReview(value: unknown): AdminReview | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const status = value.status;
  if (
    status !== "pending" &&
    status !== "approved" &&
    status !== "rejected" &&
    status !== "hidden"
  ) {
    return null;
  }

  return {
    id: value.id,
    productId: typeof value.productId === "string" ? value.productId : "",
    productName:
      typeof value.productName === "string"
        ? value.productName
        : "Purchased product",
    productSlug:
      typeof value.productSlug === "string" ? value.productSlug : null,
    reviewerName:
      typeof value.reviewerName === "string"
        ? value.reviewerName
        : "ProBee customer",
    rating: Number(value.rating ?? 0),
    title: typeof value.title === "string" ? value.title : null,
    body: typeof value.body === "string" ? value.body : "",
    status,
    isVerifiedPurchase: value.isVerifiedPurchase === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    moderatedAt:
      typeof value.moderatedAt === "string" ? value.moderatedAt : null,
    moderationReason:
      typeof value.moderationReason === "string"
        ? value.moderationReason
        : null,
  };
}

export async function getAdminReviews(
  status: ReviewStatus | "all" = "pending",
  page = 1,
  search = "",
): Promise<{ items: AdminReview[]; totalCount: number; page: number; pageSize: number; pageCount: number }> {
  await requireStaff();
  const safePage = Math.max(1, Math.min(page, 1000));
  const pageSize = 20;
  const offset = (safePage - 1) * pageSize;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_reviews", {
    p_status: status,
    p_search: search,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error || !isRecord(data)) {
    return { items: [], totalCount: 0, page: safePage, pageSize, pageCount: 1 };
  }

  return {
    items: (Array.isArray(data.items) ? data.items : [])
      .map(parseAdminReview)
      .filter((item): item is AdminReview => Boolean(item)),
    totalCount: Number(data.totalCount ?? 0),
    page: Number(data.page ?? safePage),
    pageSize: Number(data.limit ?? pageSize),
    pageCount: Number(data.pageCount ?? 1),
  };
}
