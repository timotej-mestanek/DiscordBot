import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import {
  blackMarketAssetMaxSize,
  blackMarketVideoMaxSize,
  R2ConfigurationError,
  uploadBlackMarketAsset,
  uploadBlackMarketOpeningVideo,
} from "@/lib/r2";

export const runtime = "nodejs";

const uploadTypes = new Set(["crate-preview", "crate-texture", "item-level"]);

function isUploadType(
  value: string,
): value is "crate-preview" | "crate-texture" | "item-level" | "crate-opening-video" {
  if (value === "crate-opening-video") return true;
  return uploadTypes.has(value);
}

function isCrateId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
}

export async function POST(request: Request) {
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

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > blackMarketVideoMaxSize + 64 * 1024
  ) {
    return NextResponse.json({ error: "Uploads must be no larger than 100 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload a valid file." }, { status: 400 });
  }
  const type = formData.get("type");
  const file = formData.get("file");
  if (
    typeof type !== "string" ||
    !isUploadType(type) ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: "Select a file and a valid upload type." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Select a non-empty file." }, { status: 400 });
  }
  if (type === "crate-opening-video") {
    const crateId = formData.get("crateId");
    const variant = formData.get("variant");
    if (
      !isCrateId(crateId) ||
      (variant !== "gold" && variant !== "normal") ||
      !file.name.toLowerCase().endsWith(".webm")
    ) {
      return NextResponse.json({ error: "Select a .webm video, variant, and valid crate ID." }, { status: 400 });
    }
    if (file.size > blackMarketVideoMaxSize) {
      return NextResponse.json({ error: "Opening videos must be no larger than 100 MB." }, { status: 413 });
    }
    try {
      const uploaded = await uploadBlackMarketOpeningVideo({
        crateId,
        variant,
        bytes: Buffer.from(await file.arrayBuffer()),
      });
      return NextResponse.json({ url: uploaded.url });
    } catch (error) {
      if (error instanceof R2ConfigurationError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      if (error instanceof Error && error.message.startsWith("Upload a valid WebM")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("Black Market opening video upload failed:", error);
      return NextResponse.json({ error: "Could not store the video." }, { status: 502 });
    }
  }
  if (file.size > blackMarketAssetMaxSize) {
    return NextResponse.json({ error: "Images must be no larger than 5 MB." }, { status: 413 });
  }

  try {
    const uploaded = await uploadBlackMarketAsset({
      type,
      contentType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ url: uploaded.url });
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof Error && error.message.startsWith("Upload a valid PNG")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Black Market image upload failed:", error);
    return NextResponse.json({ error: "Could not store the image." }, { status: 502 });
  }
}
