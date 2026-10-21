import { NextResponse } from "next/server";
import { createDiscordOAuthState } from "@/lib/oauth/discordState";

export async function GET() {
  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID;
  const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    console.error("Missing Discord OAuth client ID or callback URI.");
    return NextResponse.json(
      { error: "Discord linking is not configured." },
      { status: 500 },
    );
  }

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  const state = createDiscordOAuthState();
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify connections");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("discord_connections_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/discord/connections",
    maxAge: 600,
  });
  response.cookies.set("discord_link_mode", "connections", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/discord/connections/callback",
    maxAge: 600,
  });
  return response;
}
