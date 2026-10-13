import { NextResponse } from "next/server";
import { getTopTwitchClip } from "@/lib/services/twitchPublic";

export async function GET() {
  try {
    const clip = await getTopTwitchClip();
    return NextResponse.json(
      { clip },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Top-clip overlay request failed:", error);
    return NextResponse.json(
      { error: "Top klip se nepodařilo načíst." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
