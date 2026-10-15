import { saveTwitchTokens } from "@/lib/db/user"
import { NextRequest, NextResponse } from "next/server"
import { getAppUrl } from "@/lib/app-url";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.json({ error: "neco se dojebalo " }, { status: 400 })
  }

  const appUrl = getAppUrl(req.url);
  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: new URL("/api/auth/twitch", appUrl).toString()
    })
  })

  const tokens = await tokenRes.json()

  if (tokens.error) {
    return NextResponse.json({ error: tokens.error }, { status: 400 })
  }

  await saveTwitchTokens({
    userId: 1, 
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  }) 

  // Redirect späť do frontendu
  return NextResponse.redirect(new URL("/settings/integrations", appUrl))
}