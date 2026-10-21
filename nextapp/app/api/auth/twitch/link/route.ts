import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readPendingDiscordLink } from "@/lib/oauth/discordState";

export async function GET(request: NextRequest) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_LINK_REDIRECT_URI;
  const discordClientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
  const discordId = discordClientSecret
    ? readPendingDiscordLink(
        request.cookies.get("discord_twitch_pending")?.value,
        discordClientSecret,
      )
    : null;

  if (!clientId || !redirectUri || !discordId) {
    return NextResponse.json(
      { error: "Verify your Discord account first and check the Twitch linking configuration." },
      { status: 400 },
    );
  }

  const state = randomBytes(32).toString("base64url");
  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("twitch_link_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/twitch/link",
    maxAge: 600,
  });
  return response;
}
