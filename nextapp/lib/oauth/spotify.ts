import { prisma } from "@/lib/prisma";

type SpotifyTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function getValidSpotifyToken(): Promise<string> {
  const integration = await prisma.streamOverlayIntegration.findUnique({
    where: { id: "streamer" },
  });
  if (!integration?.spotify_rt) throw new Error("Spotify not connected.");

  const refreshBufferMs = 60_000;
  if (
    integration.spotify_at &&
    integration.spotify_exp &&
    Date.now() < integration.spotify_exp.getTime() - refreshBufferMs
  ) {
    return integration.spotify_at;
  }

  const refreshed = await refreshSpotifyToken(integration.spotify_rt);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.streamOverlayIntegration.update({
    where: { id: "streamer" },
    data: {
      spotify_at: refreshed.access_token,
      spotify_rt: refreshed.refresh_token ?? integration.spotify_rt,
      spotify_exp: expiresAt,
    },
  });

  return refreshed.access_token;
}

export async function refreshSpotifyToken(
  refreshToken: string,
): Promise<SpotifyTokens> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify OAuth configuration.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    console.error("Spotify token refresh returned an invalid response:", response.status);
    throw new Error("Spotify token refresh returned an invalid response.");
  }
  if (
    !response.ok ||
    typeof body !== "object" ||
    body === null ||
    !("access_token" in body) ||
    typeof body.access_token !== "string" ||
    !("expires_in" in body) ||
    typeof body.expires_in !== "number"
  ) {
    const errorCode =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string" &&
      /^[a-z_]+$/.test(body.error)
        ? body.error
        : "unknown_error";
    console.error(`Spotify token refresh failed: ${response.status} (${errorCode}).`);
    throw new Error(`Spotify token refresh failed (${errorCode}).`);
  }

  return {
    access_token: body.access_token,
    refresh_token:
      "refresh_token" in body && typeof body.refresh_token === "string"
        ? body.refresh_token
        : undefined,
    expires_in: body.expires_in,
  };
}
