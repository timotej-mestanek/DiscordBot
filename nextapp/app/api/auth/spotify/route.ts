import { NextRequest, NextResponse } from "next/server";
import { saveSpotifyTokens } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";
import { readSpotifyOAuthState } from "@/lib/oauth/spotifyState";
import { getAppUrl } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientSecret) {
    console.error("Missing Spotify OAuth client secret.");
    return NextResponse.json({ error: "Spotify není nakonfigurováno." }, { status: 500 });
  }
  const parsedState = readSpotifyOAuthState(state, clientSecret);
  if (!parsedState) {
    return NextResponse.json({ error: "Autorizace vypršela nebo není platná." }, { status: 400 });
  }
  const consumedState = await prisma.spotifyOAuthState.deleteMany({
    where: {
      nonce: parsedState.nonce,
      account_id: parsedState.accountId,
      expires_at: { gt: new Date() },
    },
  });
  if (consumedState.count !== 1) {
    return NextResponse.json({ error: "Autorizace vypršela nebo již byla použita." }, { status: 400 });
  }
  const account = await prisma.webAccount.findUnique({
    where: { id: parsedState.accountId },
    select: { role: true },
  });
  if (!account || account.role !== "admin") {
    return NextResponse.json({ error: "Přístup odepřen." }, { status: 403 });
  }

  const code = params.get("code");
  if (params.has("error") || !code) {
    return NextResponse.json({ error: "Spotify autorizace nebyla dokončena." }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    console.error("Missing Spotify OAuth configuration.");
    return NextResponse.json({ error: "Spotify není nakonfigurováno." }, { status: 500 });
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokens: unknown = await response.json();
  if (
    !response.ok ||
    typeof tokens !== "object" ||
    tokens === null ||
    !("access_token" in tokens) ||
    typeof tokens.access_token !== "string" ||
    !("refresh_token" in tokens) ||
    typeof tokens.refresh_token !== "string" ||
    !("expires_in" in tokens) ||
    typeof tokens.expires_in !== "number"
  ) {
    console.error("Spotify authorization exchange failed:", response.status);
    return NextResponse.json({ error: "Spotify ověření selhalo." }, { status: 502 });
  }

  await saveSpotifyTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  });

  const result = NextResponse.redirect(
    new URL("/?spotify=connected", getAppUrl(request.url)),
  );
  return result;
}
