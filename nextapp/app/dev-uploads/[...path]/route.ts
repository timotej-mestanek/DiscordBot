import { open, readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const contentTypes = new Map([
  ["jpg", "image/jpeg"],
  ["mp4", "video/mp4"],
  ["png", "image/png"],
  ["webm", "video/webm"],
  ["webp", "image/webp"],
]);

function isAllowedUploadPath(path: string[]) {
  if (path.some((part) => !/^[a-zA-Z0-9._-]+$/u.test(part) || part === "." || part === "..")) {
    return false;
  }
  if (path[0] === "shop-icons") return path.length === 3;
  if (path[0] !== "black-market") return false;
  return (
    (path.length === 3 &&
      ["crate-preview", "crate-texture", "item-level"].includes(path[1])) ||
    (path.length === 4 &&
      path[1] === "crates" &&
      /^(?:gold|normal)\.webm$/u.test(path[3]))
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const { path } = await params;
  if (!isAllowedUploadPath(path)) return new Response(null, { status: 404 });

  const extension = path.at(-1)?.split(".").pop() ?? "";
  const contentType = contentTypes.get(extension);
  if (!contentType) return new Response(null, { status: 404 });

  const directory = resolve(process.cwd(), "public", "dev-uploads");
  const filePath = resolve(directory, ...path);
  if (!filePath.startsWith(`${directory}${sep}`)) {
    return new Response(null, { status: 404 });
  }

  const isVideo = extension === "webm";
  const range = isVideo ? request.headers.get("range") : null;
  let fileSize: number;
  try {
    const file = await stat(filePath);
    fileSize = file.size;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }

  const headers = {
    "Accept-Ranges": isVideo ? "bytes" : "none",
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
    if (!match || (!match[1] && !match[2])) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${fileSize}` },
      });
    }

    const suffixLength = match[1] ? null : Number(match[2]);
    const start =
      suffixLength === null
        ? Number(match[1])
        : Math.max(fileSize - suffixLength, 0);
    const end =
      suffixLength === null && match[2]
        ? Math.min(Number(match[2]), fileSize - 1)
        : fileSize - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= fileSize ||
      end < start
    ) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${fileSize}` },
      });
    }

    const file = await open(filePath, "r");
    let bytes: Buffer;
    try {
      const rangeBytes = Buffer.alloc(end - start + 1);
      const { bytesRead } = await file.read(rangeBytes, 0, rangeBytes.length, start);
      bytes = rangeBytes.subarray(0, bytesRead);
    } finally {
      await file.close();
    }

    return new Response(new Uint8Array(bytes), {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(bytes.length),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      },
    });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      ...headers,
      "Content-Length": String(bytes.length),
    },
  });
}
