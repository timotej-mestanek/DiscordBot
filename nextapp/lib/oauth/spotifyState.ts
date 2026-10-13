import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

type SpotifyOAuthStatePayload = {
  accountId: string;
  nonce: string;
  expiresAt: number;
};

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createSpotifyOAuthState(
  accountId: string,
  secret: string,
): { state: string; nonce: string; expiresAt: Date } {
  const nonce = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({
      accountId,
      nonce,
      expiresAt,
    } satisfies SpotifyOAuthStatePayload),
  ).toString("base64url");
  return {
    state: `${payload}.${sign(payload, secret).toString("base64url")}`,
    nonce,
    expiresAt: new Date(expiresAt),
  };
}

export function readSpotifyOAuthState(
  receivedState: string | null,
  secret: string,
): SpotifyOAuthStatePayload | null {
  if (!receivedState) return null;

  const [payload, signature, extra] = receivedState.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expectedSignature = sign(payload, secret);
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("accountId" in parsed) ||
      typeof parsed.accountId !== "string" ||
      !("nonce" in parsed) ||
      typeof parsed.nonce !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(parsed.nonce) ||
      !("expiresAt" in parsed) ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }
    return {
      accountId: parsed.accountId,
      nonce: parsed.nonce,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
