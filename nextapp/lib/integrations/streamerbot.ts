import { timingSafeEqual } from "node:crypto";

export type StreamerBotAuthorization =
  | "authorized"
  | "unconfigured"
  | "unauthorized";

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
