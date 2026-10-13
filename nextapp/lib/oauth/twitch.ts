import { getUser } from "../db/user";
import { prisma } from "../prisma"

export async function getValidTwitchToken(userId: number) {
  const user = await getUser(userId);

  if (!user?.twitch_rt) {
    throw new Error("Twitch not connected")
  }
  if (user.twitch_at && user.twitch_exp && new Date() < user.twitch_exp) {
    return user.twitch_at
  }
  const refreshed = await refreshTwitchToken(user.twitch_rt)

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: {
      twitch_at: refreshed.access_token,
      twitch_rt: refreshed.refresh_token ?? user.twitch_rt,
      twitch_exp: expiresAt
    }
  })

  return refreshed.access_token
}

export async function refreshTwitchToken(refreshToken: string) {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
    })
  })
  const tokens = await res.json()
  return tokens 
}



