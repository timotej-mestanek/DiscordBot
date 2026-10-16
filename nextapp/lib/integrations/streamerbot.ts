import { timingSafeEqual } from "node:crypto";

export type StreamerBotAuthorization =
  | "authorized"
  | "unconfigured"
  | "unauthorized";

type TwitchAppToken = {
  value: string;
  expiresAt: number;
};

let twitchAppToken: TwitchAppToken | null = null;

export function authorizeStreamerBotRequest(
  request: Request,
): StreamerBotAuthorization {
  const expectedToken = process.env.STREAMERBOT_INGEST_TOKEN;
  if (!expectedToken) return "unconfigured";

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return "unauthorized";

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
    ? "authorized"
    : "unauthorized";
}

export function isTwitchLogin(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_]{1,25}$/.test(value);
}

export async function resolveTwitchUserId(login: string): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Twitch app credentials are not configured.");
  }

  if (!twitchAppToken || twitchAppToken.expiresAt <= Date.now() + 60_000) {
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    const tokenBody: unknown = await tokenResponse.json();
    if (
      !tokenResponse.ok ||
      typeof tokenBody !== "object" ||
      tokenBody === null ||
      !("access_token" in tokenBody) ||
      typeof tokenBody.access_token !== "string" ||
      !("expires_in" in tokenBody) ||
      typeof tokenBody.expires_in !== "number"
    ) {
      throw new Error(`Twitch app token request failed (${tokenResponse.status}).`);
    }
    twitchAppToken = {
      value: tokenBody.access_token,
      expiresAt: Date.now() + tokenBody.expires_in * 1000,
    };
  }

  const url = new URL("https://api.twitch.tv/helix/users");
  url.searchParams.set("login", login.toLowerCase());
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${twitchAppToken.value}`,
      "Client-Id": clientId,
    },
  });
  const body: unknown = await response.json();
  if (
    !response.ok ||
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    !Array.isArray(body.data)
  ) {
    if (response.status === 401) twitchAppToken = null;
    throw new Error(`Twitch user lookup failed (${response.status}).`);
  }

  const user = body.data[0];
  return typeof user === "object" &&
    user !== null &&
    "id" in user &&
    typeof user.id === "string"
    ? user.id
    : null;
}
