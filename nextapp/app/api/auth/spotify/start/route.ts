import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { createSpotifyOAuthState } from "@/lib/oauth/spotifyState";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Missing Spotify OAuth client ID or callback URI.");
    return NextResponse.json({ error: "Spotify is not configured." }, { status: 500 });
  }

  const { state, nonce, expiresAt } = createSpotifyOAuthState(
    account.id,
    clientSecret,
  );
  await prisma.spotifyOAuthState.deleteMany({
    where: { expires_at: { lte: new Date() } },
  });
  await prisma.spotifyOAuthState.create({
    data: { nonce, account_id: account.id, expires_at: expiresAt },
  });
  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("show_dialog", "true");
  authorizeUrl.searchParams.set(
    "scope",
    "user-read-email user-read-private user-read-currently-playing",
  );
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  return response;
}
