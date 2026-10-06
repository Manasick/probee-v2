import { NextResponse } from "next/server";
import { getPublicCatalogProductsByIds } from "@/lib/catalog/server";
import { MAX_CART_LINES, normalizeCartItems } from "@/lib/cart/storage";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid cart payload." },
      { status: 400 },
    );
  }

  const sourceItems =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).items
      : null;

  if (!Array.isArray(sourceItems) || sourceItems.length > MAX_CART_LINES) {
    return NextResponse.json(
      { error: "Cart contains too many items." },
      { status: 400 },
    );
  }

  const items = normalizeCartItems(sourceItems);

  if (items.length === 0) {
    return NextResponse.json({
      items: [],
      unavailable: [],
    });
  }

  const products = await getPublicCatalogProductsByIds(
    items.map((item) => item.productId),
  );

  const productsById = new Map(products.map((product) => [product.id, product]));

  const rehydrated = [];
  const unavailable = [];

  for (const item of items) {
    const product = productsById.get(item.productId);
    const plan = product?.plans.find(
      (candidate) => candidate.id === item.planId && candidate.active !== false,
    );

    if (!product || !plan) {
      unavailable.push(item);
      continue;
    }

    rehydrated.push({
      item,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        coverUrl: product.coverUrl,
      },
      plan,
    });
  }

  return NextResponse.json(
    {
      items: rehydrated,
      unavailable,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
