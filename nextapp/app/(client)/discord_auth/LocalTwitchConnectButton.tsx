"use client";

export default function LocalTwitchConnectButton() {
  return (
    <a
      href="/api/auth/discord/local"
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-6 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-900"
    >
      Ověřit Twitch samostatně
    </a>
  );
}
