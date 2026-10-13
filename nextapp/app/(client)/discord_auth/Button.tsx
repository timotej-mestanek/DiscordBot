"use client";

export default function DiscordTwitchConnectButton() {
  return (
    <a
      href="/api/auth/discord/connections"
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#5865F2] px-6 font-medium text-white transition-colors hover:bg-[#4752C4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
    >
      Použít Twitch z Discordu
    </a>
  );
}
