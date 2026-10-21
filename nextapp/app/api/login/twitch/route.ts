import { NextResponse } from "next/server";
import { startOAuth } from "@/lib/auth/oauth";

export async function GET() {
  try {
    return startOAuth("twitch");
  } catch (error) {
    console.error("Unable to start Twitch login:", error);
    return NextResponse.json(
      { error: "Twitch sign-in is not configured." },
      { status: 500 },
    );
  }
}
