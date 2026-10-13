import { NextResponse } from "next/server";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";

export async function GET() {
  try {
    const status = await getTwitchLiveStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Twitch live status endpoint failed:", error);
    return NextResponse.json(
      { error: "Stav streamu se nepodařilo ověřit." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
