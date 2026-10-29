import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const SHOP_ICON_PREFIX = "shop-icons";
const MAX_SHOP_ICON_SIZE = 2 * 1024 * 1024;
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
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/u, "");
  if (!baseUrl) {
    throw new R2ConfigurationError(
      "R2_PUBLIC_BASE_URL must contain the public HTTPS URL for the R2 bucket.",
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

export function ensureR2Configured() {
  getR2Client();
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

  const { client: r2, bucket } = getR2Client();
  const baseUrl = getR2PublicBaseUrl();
  const key = `${SHOP_ICON_PREFIX}/${input.productId}/${randomUUID()}.${type.extension}`;
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.bytes,
      ContentLength: input.bytes.length,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return { key, url: `${baseUrl}/${encodedKey}` };
}

export async function deleteR2Object(key: string) {
  const { client: r2, bucket } = getR2Client();
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function isShopIconKeyForProduct(key: string, productId: string) {
  return key.startsWith(`${SHOP_ICON_PREFIX}/${productId}/`);
}

export const shopIconMaxSize = MAX_SHOP_ICON_SIZE;
