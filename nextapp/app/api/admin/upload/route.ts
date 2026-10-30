import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import {
  blackMarketAssetMaxSize,
  blackMarketModelMaxSize,
  R2ConfigurationError,
  uploadBlackMarketAsset,
  uploadBlackMarketModel,
} from "@/lib/r2";

export const runtime = "nodejs";

const uploadTypes = new Set(["crate-preview", "crate-texture", "item-level"]);

function isUploadType(
  value: string,
): value is "crate-preview" | "crate-texture" | "item-level" | "crate-model" {
  if (value === "crate-model") return true;
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
    contentLength > blackMarketModelMaxSize + 64 * 1024
  ) {
    return NextResponse.json({ error: "Uploads must be no larger than 15 MB." }, { status: 413 });
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
    return NextResponse.json({ error: "Select an image and a valid upload type." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Select a non-empty file." }, { status: 400 });
  }
  if (type === "crate-model") {
    const crateId = formData.get("crateId");
    if (!isCrateId(crateId) || !file.name.toLowerCase().endsWith(".glb")) {
      return NextResponse.json({ error: "Select a .glb model and a valid crate ID." }, { status: 400 });
    }
    if (file.size > blackMarketModelMaxSize) {
      return NextResponse.json({ error: "3D models must be no larger than 15 MB." }, { status: 413 });
    }
    try {
      const uploaded = await uploadBlackMarketModel({
        crateId,
        bytes: Buffer.from(await file.arrayBuffer()),
      });
      return NextResponse.json({ url: uploaded.url });
    } catch (error) {
      if (error instanceof R2ConfigurationError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      if (error instanceof Error && error.message.startsWith("Upload a valid glTF")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("Black Market 3D model upload failed:", error);
      return NextResponse.json({ error: "Could not upload the model to R2." }, { status: 502 });
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
    return NextResponse.json({ error: "Could not upload the image to R2." }, { status: 502 });
  }
}
