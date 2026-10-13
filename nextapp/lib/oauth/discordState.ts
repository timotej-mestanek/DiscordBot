import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createDiscordOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function matchesDiscordOAuthState(
  receivedState: string | null,
  cookieState: string | undefined,
): boolean {
  if (
    !receivedState ||
    !cookieState ||
    !STATE_PATTERN.test(receivedState) ||
    !STATE_PATTERN.test(cookieState)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(receivedState, "base64url"),
    Buffer.from(cookieState, "base64url"),
  );
}

export function createPendingDiscordLink(
  discordId: string,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ discordId, expiresAt: Date.now() + 10 * 60 * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readPendingDiscordLink(
  value: string | undefined,
  secret: string,
): string | null {
  if (!value) return null;

  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = createHmac("sha256", secret).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "discordId" in parsed &&
      typeof parsed.discordId === "string" &&
      /^\d{17,20}$/.test(parsed.discordId) &&
      "expiresAt" in parsed &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now()
    ) {
      return parsed.discordId;
    }
  } catch {
    return null;
  }

  return null;
}
