import { unstable_cache } from "next/cache";
import { getValidSpotifyToken } from "@/lib/oauth/spotify";

export type SpotifyPlayback = {
  is_playing: boolean;
  item: {
    name: string;
    artists: Array<{ name: string }>;
    external_urls?: { spotify?: string };
    album?: { images?: Array<{ url: string }> };
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getCurrentPlayBack(): Promise<SpotifyPlayback | null> {
  const token = await getValidSpotifyToken();
  const response = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 204) return null;
  if (!response.ok) {
    console.error("Spotify playback lookup failed:", response.status);
    throw new Error("Spotify playback lookup failed.");
  }

  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    typeof body.is_playing !== "boolean" ||
    !("item" in body)
  ) {
    throw new Error("Spotify returned an invalid playback response.");
  }
  if (body.item === null) return { is_playing: body.is_playing, item: null };
  if (
    !isRecord(body.item) ||
    typeof body.item.name !== "string" ||
    !Array.isArray(body.item.artists)
  ) {
    throw new Error("Spotify returned an invalid track.");
  }

  const externalUrls = isRecord(body.item.external_urls)
    ? body.item.external_urls
    : null;
  const album = isRecord(body.item.album) ? body.item.album : null;
  const images = Array.isArray(album?.images)
    ? album.images.flatMap((image) =>
        isRecord(image) && typeof image.url === "string"
          ? [{ url: image.url }]
          : [],
      )
    : undefined;

  return {
    is_playing: body.is_playing,
    item: {
      name: body.item.name,
      artists: body.item.artists.flatMap((artist) =>
        isRecord(artist) && typeof artist.name === "string"
          ? [{ name: artist.name }]
          : [],
      ),
      external_urls:
        typeof externalUrls?.spotify === "string"
          ? { spotify: externalUrls.spotify }
          : undefined,
      album: images ? { images } : undefined,
    },
  };
}

export const getCachedCurrentPlayback = unstable_cache(
  getCurrentPlayBack,
  ["spotify-current-playback"],
  { revalidate: 5 },
);
