"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useLivePointBalances } from "@/app/useLivePointBalances";

type Currency = "discord" | "twitch_custom";
type Rate = {
  source_currency: Currency;
  target_currency: Currency;
  source_amount: number;
  target_amount: number;
  enabled: boolean;
};

export type AccountBalances = {
  discord: number | null;
  twitchCustom: number | null;
  twitchChannelPoints: null;
};

function currencyName(currency: Currency) {
  return currency === "discord" ? "Discord points" : "Twitch CustomBody";
}

export default function DashboardPoints({
  balances,
  rates,
}: {
  balances: AccountBalances;
  rates: Rate[];
}) {
  const [message, setMessage] = useState("");
  const { balances: liveBalances, error: balanceError } = useLivePointBalances({
    discord: balances.discord,
    twitchCustom: balances.twitchCustom,
  });
  const linked = {
    discord: liveBalances.discord !== null,
    twitch_custom: liveBalances.twitchCustom !== null,
  };

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/points/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: form.get("source"),
          target: form.get("target"),
          sourceAmount: Number(form.get("sourceAmount")),
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "The conversion could not be completed.");
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error("Point conversion request failed:", error);
      setMessage("The conversion could not be completed.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {liveBalances.discord !== null && (
          <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Discord points</p>
            <p className="mt-1 text-2xl font-bold">{liveBalances.discord.toLocaleString("en-US")}</p>
          </article>
        )}
        {liveBalances.twitchCustom !== null && (
          <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Twitch CustomBody</p>
            <p className="mt-1 text-2xl font-bold">{liveBalances.twitchCustom.toLocaleString("en-US")}</p>
          </article>
        )}
        {liveBalances.twitchCustom !== null && (
          <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:col-span-2">
            <p className="text-sm font-semibold">Twitch Channel Points</p>
            <p className="mt-1 text-sm text-zinc-400">
              Not available via Twitch API; cannot be converted.
            </p>
          </article>
        )}
      </div>

      {balanceError && (
        <p role="status" className="text-sm text-amber-300">
          {balanceError} Showing the last available balance.
        </p>
      )}

      {liveBalances.discord === null && liveBalances.twitchCustom === null && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
          Link a Discord or Twitch account in Account to view your points.
        </p>
      )}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold">Conversions</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {rates
            .filter((rate) => rate.enabled && linked[rate.source_currency] && linked[rate.target_currency])
            .map((rate) => (
              <form
                key={`${rate.source_currency}-${rate.target_currency}`}
                onSubmit={convert}
                className="rounded-md border border-zinc-800 p-3"
              >
                <input type="hidden" name="source" value={rate.source_currency} />
                <input type="hidden" name="target" value={rate.target_currency} />
                <h3 className="font-semibold">
                  {currencyName(rate.source_currency)} → {currencyName(rate.target_currency)}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {rate.source_amount} → {rate.target_amount}
                </p>
                <label className="mt-3 block text-sm text-zinc-300">
                  Amount of {currencyName(rate.source_currency)}
                  <input
                    name="sourceAmount"
                    type="number"
                    min={rate.source_amount}
                    step={rate.source_amount}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                  />
                </label>
                <button className="mt-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold hover:bg-violet-500">
                  Convert points
                </button>
              </form>
            ))}
          {rates.every((rate) => !rate.enabled) && (
            <p className="text-sm text-zinc-500">
              No conversions have been configured or enabled yet.
            </p>
          )}
        </div>
        {message && <p role="alert" className="mt-4 text-sm text-red-300">{message}</p>}
      </section>
    </div>
  );
}
