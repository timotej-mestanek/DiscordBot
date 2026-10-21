"use client";

export default function SpotifyConnectButton() {
  return (
    <a
      href="/api/auth/spotify/start"
      className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
    >
      Connect Spotify
    </a>
  );
}
