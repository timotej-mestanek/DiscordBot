import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const SHOP_ICON_PREFIX = "shop-icons";
const MAX_SHOP_ICON_SIZE = 2 * 1024 * 1024;
const BLACK_MARKET_ASSET_PREFIX = "black-market";
const DEV_UPLOAD_PREFIX = "dev-uploads";
const MAX_BLACK_MARKET_ASSET_SIZE = 5 * 1024 * 1024;
const MAX_BLACK_MARKET_VIDEO_SIZE = 100 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
  ["image/webp", { extension: "webp", signature: null }],
]);

export class R2ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ConfigurationError";
  }
}

let client: S3Client | null = null;

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function getDevUploadPath(key: string) {
  if (!key.startsWith(`${DEV_UPLOAD_PREFIX}/`)) {
    throw new Error("Invalid local upload key.");
  }
  const directory = resolve(process.cwd(), "public", DEV_UPLOAD_PREFIX);
  const filePath = resolve(process.cwd(), "public", ...key.split("/"));
  if (!filePath.startsWith(`${directory}${sep}`)) {
    throw new Error("Invalid local upload key.");
  }
  return filePath;
}

async function uploadObject(key: string, bytes: Buffer, contentType: string) {
  if (isDevelopment()) {
    const devKey = `${DEV_UPLOAD_PREFIX}/${key}`;
    const filePath = getDevUploadPath(devKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    return {
      key: devKey,
      url: `/${devKey.split("/").map(encodeURIComponent).join("/")}`,
    };
  }

  const { client: r2, bucket } = getR2Client();
  const baseUrl = getR2PublicBaseUrl();
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentLength: bytes.length,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return { key, url: `${baseUrl}/${encodedKey}` };
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new R2ConfigurationError(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.",
    );
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return { client, bucket };
}

function getR2PublicBaseUrl() {
  const baseUrl = (
    process.env.R2_PUBLIC_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim()
  )?.replace(/\/+$/u, "");
  if (!baseUrl) {
    throw new R2ConfigurationError(
      "R2_PUBLIC_URL must contain the public HTTPS URL for the R2 bucket.",
    );
  }
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new R2ConfigurationError("R2_PUBLIC_BASE_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:") {
    throw new R2ConfigurationError("R2_PUBLIC_BASE_URL must use HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new R2ConfigurationError(
      "R2_PUBLIC_BASE_URL must not include credentials, a query, or a fragment.",
    );
  }
  return baseUrl;
}

export async function uploadBlackMarketAsset(input: {
  type: "crate-preview" | "crate-texture" | "item-level";
  contentType: string;
  bytes: Buffer;
}) {
  const type = allowedTypes.get(input.contentType);
  if (
    !type ||
    input.bytes.length === 0 ||
    input.bytes.length > MAX_BLACK_MARKET_ASSET_SIZE ||
    !isValidImageSignature(input.contentType, input.bytes)
  ) {
    throw new Error("Upload a valid PNG, JPEG, or WebP image up to 5 MB.");
  }

  const key = `${BLACK_MARKET_ASSET_PREFIX}/${input.type}/${randomUUID()}.${type.extension}`;
  return uploadObject(key, input.bytes, input.contentType);
}

export async function uploadBlackMarketOpeningVideo(input: {
  crateId: string;
  variant: "gold" | "normal";
  bytes: Buffer;
}) {
  const isWebm =
    input.bytes.length >= 4 &&
    input.bytes.toString("hex", 0, 4) === "1a45dfa3";
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(input.crateId) ||
    input.bytes.length === 0 ||
    input.bytes.length > MAX_BLACK_MARKET_VIDEO_SIZE ||
    !isWebm
  ) {
    throw new Error("Upload a valid WebM opening video up to 100 MB.");
  }

  const key = `${BLACK_MARKET_ASSET_PREFIX}/crates/${input.crateId}/${input.variant}.webm`;
  const uploaded = await uploadObject(key, input.bytes, "video/webm");
  return {
    key: uploaded.key,
    url: `${uploaded.url}?v=${randomUUID()}`,
  };
}

export function isBlackMarketCrateAssetUrl(
  value: unknown,
  kind: "preview" | "video",
  crateId: string,
  videoVariant?: "gold" | "normal",
): value is string {
  if (typeof value !== "string") return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(crateId)) return false;
  if (kind === "video" && videoVariant !== "gold" && videoVariant !== "normal") {
    return false;
  }
  const isAssetPath = (path: string) =>
    kind === "preview"
      ? /^black-market\/crate-preview\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/iu.test(path)
      : new RegExp(
          `^black-market/crates/${crateId}/${videoVariant}\\.webm$`,
          "u",
        ).test(path);

  if (isDevelopment() && value.startsWith(`/${DEV_UPLOAD_PREFIX}/`)) {
    try {
      const url = new URL(value, "http://localhost");
      const path = url.pathname.slice(`/${DEV_UPLOAD_PREFIX}/`.length);
      const validVersion =
        kind === "video" &&
        Array.from(url.searchParams).length === 1 &&
        /^[0-9a-f-]{36}$/iu.test(url.searchParams.get("v") ?? "");
      return (
        url.origin === "http://localhost" &&
        !url.username &&
        !url.password &&
        !url.hash &&
        (kind === "video" ? validVersion : !url.search) &&
        isAssetPath(path)
      );
    } catch {
      return false;
    }
  }

  try {
    const url = new URL(value);
    const baseUrl = new URL(getR2PublicBaseUrl());
    const basePath = baseUrl.pathname.replace(/\/+$/u, "");
    const path = url.pathname.startsWith(`${basePath}/`)
      ? url.pathname.slice(basePath.length + 1)
      : "";
    const validVersion =
      kind === "video" &&
      Array.from(url.searchParams).length === 1 &&
      /^[0-9a-f-]{36}$/iu.test(url.searchParams.get("v") ?? "");
    return (
      url.protocol === "https:" &&
      url.origin === baseUrl.origin &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (kind === "video" ? validVersion : !url.search) &&
      isAssetPath(path)
    );
  } catch {
    return false;
  }
}

export function isBlackMarketItemImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (
    isDevelopment() &&
    value.startsWith(`/${DEV_UPLOAD_PREFIX}/${BLACK_MARKET_ASSET_PREFIX}/item-level/`)
  ) {
    try {
      const url = new URL(value, "http://localhost");
      return (
        url.origin === "http://localhost" &&
        !url.search &&
        !url.hash &&
        url.pathname.startsWith(
          `/${DEV_UPLOAD_PREFIX}/${BLACK_MARKET_ASSET_PREFIX}/item-level/`,
        )
      );
    } catch {
      return false;
    }
  }
  let url: URL;
  let baseUrl: URL;
  try {
    url = new URL(value);
    baseUrl = new URL(getR2PublicBaseUrl());
  } catch {
    return false;
  }
  const basePath = baseUrl.pathname.replace(/\/+$/u, "");
  return (
    url.protocol === "https:" &&
    url.origin === baseUrl.origin &&
    !url.search &&
    !url.hash &&
    url.pathname.startsWith(`${basePath}/${BLACK_MARKET_ASSET_PREFIX}/item-level/`)
  );
}

function isValidImageSignature(contentType: string, bytes: Buffer) {
  const type = allowedTypes.get(contentType);
  if (!type) return false;
  if (type.signature) {
    return type.signature.every((byte, index) => bytes[index] === byte);
  }
  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

export async function uploadShopIcon(input: {
  productId: string;
  contentType: string;
  bytes: Buffer;
}) {
  const type = allowedTypes.get(input.contentType);
  if (
    !type ||
    input.bytes.length === 0 ||
    input.bytes.length > MAX_SHOP_ICON_SIZE ||
    !isValidImageSignature(input.contentType, input.bytes)
  ) {
    throw new Error("Upload a valid PNG, JPEG, or WebP image up to 2 MB.");
  }

  const key = `${SHOP_ICON_PREFIX}/${input.productId}/${randomUUID()}.${type.extension}`;
  return uploadObject(key, input.bytes, input.contentType);
}

export async function deleteStoredUpload(key: string) {
  if (key.startsWith(`${DEV_UPLOAD_PREFIX}/`)) {
    if (!isDevelopment()) {
      throw new Error("Cannot delete a local development upload in production.");
    }
    await unlink(getDevUploadPath(key));
    return;
  }
  const { client: r2, bucket } = getR2Client();
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function isShopIconKeyForProduct(key: string, productId: string) {
  return (
    key.startsWith(`${SHOP_ICON_PREFIX}/${productId}/`) ||
    key.startsWith(`${DEV_UPLOAD_PREFIX}/${SHOP_ICON_PREFIX}/${productId}/`)
  );
}

export const shopIconMaxSize = MAX_SHOP_ICON_SIZE;
export const blackMarketAssetMaxSize = MAX_BLACK_MARKET_ASSET_SIZE;
export const blackMarketVideoMaxSize = MAX_BLACK_MARKET_VIDEO_SIZE;
