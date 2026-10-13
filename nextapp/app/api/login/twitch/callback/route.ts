import { NextRequest } from "next/server";
import { completeOAuth } from "@/lib/auth/oauth";

export async function GET(request: NextRequest) {
  return completeOAuth(request, "twitch");
}
