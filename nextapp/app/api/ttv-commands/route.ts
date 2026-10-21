import { NextResponse } from "next/server";
import { ttvCommandGroups } from "@/lib/ttv-commands";

export const dynamic = "force-dynamic";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
};

export async function GET() {
  return NextResponse.json(
    { schemaVersion: 1, groups: ttvCommandGroups },
    { headers },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers });
}
