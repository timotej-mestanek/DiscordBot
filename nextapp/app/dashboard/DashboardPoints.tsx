"use client";

import { useState } from "react";
import type { FormEvent } from "react";

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
  return currency === "discord" ? "Discord body" : "Twitch CustomBody";
}

export default function DashboardPoints({
  balances,
  rates,
}: {
  balances: AccountBalances;
  rates: Rate[];
}) {
  const [message, setMessage] = useState("");
  const linked = {
    discord: balances.discord !== null,
    twitch_custom: balances.twitchCustom !== null,
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
        setMessage(result.error ?? "Konverzi se nepodařilo dokončit.");
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error("Point conversion request failed:", error);
      setMessage("Konverzi se nepodařilo dokončit.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {balances.discord !== null && (
          <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-400">Discord body</p>
            <p className="mt-2 text-3xl font-bold">{balances.discord.toLocaleString("cs-CZ")}</p>
          </article>
        )}
        {balances.twitchCustom !== null && (
          <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-400">Twitch CustomBody</p>
            <p className="mt-2 text-3xl font-bold">{balances.twitchCustom.toLocaleString("cs-CZ")}</p>
          </article>
        )}
        {balances.twitchCustom !== null && (
          <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:col-span-2">
            <p className="text-sm font-semibold">Twitch Channel Points</p>
            <p className="mt-2 text-sm text-zinc-400">
              Twitch neposkytuje aplikaci API pro zobrazení osobního zůstatku Channel Points.
              Tyto body proto nelze načíst ani převádět.
            </p>
          </article>
        )}
      </div>

      {balances.discord === null && balances.twitchCustom === null && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
          Pro zobrazení bodů připoj Discord nebo Twitch účet v záložce Autorizace.
        </p>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Konverze</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Channel Points nejsou do konverzí zahrnuté. Dostupné směnné kurzy spravuje administrátor.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {rates
            .filter((rate) => rate.enabled && linked[rate.source_currency] && linked[rate.target_currency])
            .map((rate) => (
              <form
                key={`${rate.source_currency}-${rate.target_currency}`}
                onSubmit={convert}
                className="rounded-lg border border-zinc-800 p-4"
              >
                <input type="hidden" name="source" value={rate.source_currency} />
                <input type="hidden" name="target" value={rate.target_currency} />
                <h3 className="font-semibold">
                  {currencyName(rate.source_currency)} → {currencyName(rate.target_currency)}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {rate.source_amount} → {rate.target_amount}
                </p>
                <label className="mt-4 block text-sm text-zinc-300">
                  Počet {currencyName(rate.source_currency)}
                  <input
                    name="sourceAmount"
                    type="number"
                    min={rate.source_amount}
                    step={rate.source_amount}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                  />
                </label>
                <button className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500">
                  Směnit body
                </button>
              </form>
            ))}
          {rates.every((rate) => !rate.enabled) && (
            <p className="text-sm text-zinc-500">
              Konverze zatím nejsou nastavené nebo zapnuté.
            </p>
          )}
        </div>
        {message && <p role="alert" className="mt-4 text-sm text-red-300">{message}</p>}
      </section>
    </div>
  );
}
