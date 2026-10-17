import { createHmac } from "node:crypto";

const TWITCH_EXTENSION_PUBSUB_URL =
  "https://api.twitch.tv/helix/extensions/pubsub";
const MAX_MESSAGE_BYTES = 5_000;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createExtensionToken(
  extensionId: string,
  broadcasterId: string,
  encodedSecret: string,
): string {
  const secret = Buffer.from(encodedSecret, "base64");
  if (secret.length === 0) {
    throw new Error("Twitch Extension secret must be base64-encoded.");
  }

  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      exp: now + 60,
      iat: now,
      channel_id: broadcasterId,
      role: "external",
      pubsub_perms: { send: ["*"] },
    }),
  );
  const content = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(content).digest();
  return `${content}.${base64Url(signature)}`;
}

export async function publishExtensionBroadcast(message: unknown): Promise<void> {
  const extensionId = process.env.TWITCH_EXTENSION_ID;
  const encodedSecret = process.env.TWITCH_EXTENSION_SECRET_BASE64;
  const broadcasterId = process.env.TWITCH_EXTENSION_BROADCASTER_ID;
  if (!extensionId || !encodedSecret || !broadcasterId) {
    throw new Error("Twitch Extension PubSub is not configured.");
  }

  const serializedMessage = JSON.stringify(message);
  if (Buffer.byteLength(serializedMessage, "utf8") > MAX_MESSAGE_BYTES) {
    throw new Error("Twitch Extension PubSub message exceeds 5000 bytes.");
  }

  const response = await fetch(TWITCH_EXTENSION_PUBSUB_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${createExtensionToken(
        extensionId,
        broadcasterId,
        encodedSecret,
      )}`,
      "Client-Id": extensionId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      target: ["broadcast"],
      is_global_broadcast: false,
      message: serializedMessage,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const responseBody: unknown = await response.json().catch(() => null);
    const errorMessage =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "message" in responseBody &&
      typeof responseBody.message === "string"
        ? responseBody.message
        : response.statusText;
    console.error(
      "Twitch Extension PubSub publish failed:",
      response.status,
      errorMessage,
    );
    throw new Error(
      `Twitch Extension PubSub publish failed (${response.status}): ${errorMessage}`,
    );
  }
}
