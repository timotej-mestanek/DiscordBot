import { NextResponse } from "next/server";
import { getCachedPubgDailyStats } from "@/lib/services/pubg";

export async function GET(request: Request) {
  const player = new URL(request.url).searchParams.get("player")?.trim();
  if (!player || player.length > 32 || /[^\p{L}\p{N}_-]/u.test(player)) {
    return NextResponse.json(
      { error: "Zadej platný PUBG nickname." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const stats = await getCachedPubgDailyStats(player);
    return NextResponse.json(
      { stats },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("PUBG overlay request failed:", error);
    return NextResponse.json(
      { error: "PUBG statistiky se nepodařilo načíst." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
