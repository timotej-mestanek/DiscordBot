import { NextResponse } from "next/server";
import { startOAuth } from "@/lib/auth/oauth";

export async function GET() {
  try {
    return startOAuth("discord");
  } catch (error) {
    console.error("Unable to start Discord login:", error);
    return NextResponse.json(
      { error: "Discord přihlášení není nakonfigurované." },
      { status: 500 },
    );
  }
}
