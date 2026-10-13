"use client"

export default function TwitchConnectButton() {
  const handleConnect = () => {
    const url = new URL("https://id.twitch.tv/oauth2/authorize")
    url.searchParams.set("client_id", "4gaphqdrbdvpadou2t3yz0qmt6ssfn")
    url.searchParams.set(
      "redirect_uri",
      "http://localhost:3000/api/auth/twitch"
    )
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", "user:read:email channel:manage:redemptions")
    window.location.href = url.toString()
  }

  return <button onClick={handleConnect}>Connect Twitch</button>
}

