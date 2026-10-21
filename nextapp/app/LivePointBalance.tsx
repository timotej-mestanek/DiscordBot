"use client";

import { useLivePointBalances } from "@/app/useLivePointBalances";
import type { LivePointBalances } from "@/app/useLivePointBalances";

export default function LivePointBalance({
  initial,
}: {
  initial: LivePointBalances;
}) {
  const { balances, error } = useLivePointBalances(initial);

  return (
    <div
      aria-label="Live point balances"
      className="hidden text-right text-xs leading-5 text-zinc-400 sm:block"
      title={error || "Balances refresh automatically."}
    >
      {balances.discord !== null && (
        <p>
          Discord{" "}
          <span className="font-semibold tabular-nums text-white">
            {balances.discord.toLocaleString("en-US")}
          </span>
        </p>
      )}
      {balances.twitchCustom !== null && (
        <p>
          Twitch{" "}
          <span className="font-semibold tabular-nums text-white">
            {balances.twitchCustom.toLocaleString("en-US")}
          </span>
        </p>
      )}
      {error && (
        <span role="status" className="text-[10px] text-amber-300">
          Balance not updated
        </span>
      )}
    </div>
  );
}
