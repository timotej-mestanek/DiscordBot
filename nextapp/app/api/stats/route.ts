import { get_stats } from "@/lib/db/stats"
import { StatsMode } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "fulltime";
  const limit = searchParams.get("limit");

  const data = await get_stats({
    mode: mode as StatsMode,
    limit: limit ? parseInt(limit) : undefined,
  });

  return Response.json({ data });
}