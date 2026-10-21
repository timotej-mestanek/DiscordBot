import { NextResponse } from "next/server";
import { getPointRanking } from "@/lib/points";

export const dynamic = "force-dynamic";

export async function GET() {
  const [overall, twitch, discord] = await Promise.all([
    getPointRanking("overall", 10),
    getPointRanking("twitch", 10),
    getPointRanking("discord", 10),
  ]);

  return NextResponse.json(
    {
      overall,
      twitch,
      discord,
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
