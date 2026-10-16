import { getCurrentAccount } from "@/lib/auth/session";

export async function getCurrentAdmin() {
  const account = await getCurrentAccount();
  return account?.role === "admin" ? account : null;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",", 1)[0]
      ?.trim();
    const requestHost =
      forwardedHost || request.headers.get("host") || new URL(request.url).host;
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",", 1)[0]
      ?.trim();
    const requestProtocol =
      forwardedProtocol || new URL(request.url).protocol.replace(/:$/, "");
    const expectedOrigin = new URL(`${requestProtocol}://${requestHost}`).origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
