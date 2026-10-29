import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import {
  deleteR2Object,
  ensureR2Configured,
  isShopIconKeyForProduct,
  R2ConfigurationError,
  shopIconMaxSize,
  uploadShopIcon,
} from "@/lib/r2";

export const runtime = "nodejs";

async function getAdmin(request: Request): Promise<NextResponse | { accountId: string }> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  return { accountId: account.id };
}

function isProductId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[a-zA-Z0-9_-]+$/u.test(value)
  );
}

export async function POST(request: Request) {
  const auth = await getAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > shopIconMaxSize + 64 * 1024) {
    return NextResponse.json({ error: "Shop icons must be no larger than 2 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a valid image file." }, { status: 400 });
  }
  const productId = formData.get("productId");
  const file = formData.get("file");
  if (!isProductId(productId) || !(file instanceof File)) {
    return NextResponse.json({ error: "Select a shop product and an image." }, { status: 400 });
  }
  if (file.size > shopIconMaxSize) {
    return NextResponse.json({ error: "Shop icons must be no larger than 2 MB." }, { status: 413 });
  }

  let uploadedKey: string | null = null;
  try {
    const oldProduct = await prisma.shopProduct.findUnique({
      where: { id: productId },
      select: { id: true, image_key: true },
    });
    if (!oldProduct) {
      return NextResponse.json({ error: "Shop product not found." }, { status: 404 });
    }
    if (
      oldProduct.image_key &&
      !isShopIconKeyForProduct(oldProduct.image_key, oldProduct.id)
    ) {
      return NextResponse.json(
        { error: "The stored shop image key is invalid." },
        { status: 409 },
      );
    }

    const uploaded = await uploadShopIcon({
      productId,
      contentType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    uploadedKey = uploaded.key;
    const saved = await prisma.shopProduct.updateMany({
      where: { id: productId, image_key: oldProduct.image_key },
      data: { image_key: uploaded.key, image_url: uploaded.url },
    });
    if (saved.count !== 1) {
      await deleteR2Object(uploaded.key);
      return NextResponse.json(
        { error: "The product image changed during upload. Refresh and try again." },
        { status: 409 },
      );
    }

    let warning: string | undefined;
    if (oldProduct.image_key) {
      try {
        await deleteR2Object(oldProduct.image_key);
      } catch (deleteError) {
        console.error("Could not remove the replaced shop image from R2:", deleteError);
        warning = "The new image was saved, but the previous file could not be removed from R2.";
      }
    }
    return NextResponse.json({ ok: true, imageUrl: uploaded.url, imageKey: uploaded.key, warning });
  } catch (error) {
    if (uploadedKey) {
      try {
        await deleteR2Object(uploadedKey);
      } catch (cleanupError) {
        console.error("Could not clean up an unsuccessful shop image upload:", cleanupError);
      }
    }
    if (error instanceof R2ConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof Error && error.message.startsWith("Upload a valid PNG")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Shop image upload failed:", error);
    return NextResponse.json({ error: "Could not upload the shop image to R2." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("productId" in body) ||
    !isProductId(body.productId)
  ) {
    return NextResponse.json({ error: "Select a valid shop product." }, { status: 400 });
  }

  let product;
  try {
    ensureR2Configured();
    product = await prisma.shopProduct.findUnique({
      where: { id: body.productId },
      select: { id: true, image_key: true },
    });
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Shop image lookup failed:", error);
    return NextResponse.json({ error: "Could not load the shop image." }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json({ error: "Shop product not found." }, { status: 404 });
  }
  if (!product.image_key) {
    return NextResponse.json({ error: "This product has no image to remove." }, { status: 409 });
  }
  if (!isShopIconKeyForProduct(product.image_key, product.id)) {
    console.error("Refusing to delete an unexpected R2 object key for a shop icon.", {
      productId: product.id,
      imageKey: product.image_key,
    });
    return NextResponse.json({ error: "The stored shop image key is invalid." }, { status: 409 });
  }

  let cleared;
  try {
    cleared = await prisma.shopProduct.updateMany({
      where: { id: product.id, image_key: product.image_key },
      data: { image_key: null, image_url: null },
    });
  } catch (error) {
    console.error("Could not clear the shop image reference:", error);
    return NextResponse.json({ error: "Could not remove the shop image." }, { status: 500 });
  }
  if (cleared.count !== 1) {
    return NextResponse.json(
      { error: "The product image changed during removal. Refresh and try again." },
      { status: 409 },
    );
  }

  try {
    await deleteR2Object(product.image_key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not remove shop image from R2:", error);
    return NextResponse.json(
      {
        ok: false,
        imageRemoved: true,
        error: "The image was removed from the product, but its file could not be deleted from R2.",
      },
      { status: 502 },
    );
  }
}
