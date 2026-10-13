import { NextResponse } from "next/server";
import { getCachedCurrentPlayback } from "@/lib/services/spotifyService";

export async function GET() {
  try {
    const playback = await getCachedCurrentPlayback();
    return NextResponse.json(
      { playback },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Now-playing overlay request failed:", error);
    return NextResponse.json(
      { error: "Aktuální skladbu se nepodařilo načíst." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
