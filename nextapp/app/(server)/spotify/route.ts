import { getCurrentPlayBack } from "@/lib/services/spotifyService";
import { NextResponse } from "next/server";

export async function GET() {
    const data = await getCurrentPlayBack();
    return NextResponse.json({data});
}