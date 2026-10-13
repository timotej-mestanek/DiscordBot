"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

type Widget = "cs2" | "pubg";

const subscribeToOrigin = () => () => {};
const getServerOrigin = () => "";
const getBrowserOrigin = () => window.location.origin;

export default function OverlayBuilder() {
  const [widget, setWidget] = useState<Widget>("cs2");
  const [player, setPlayer] = useState("");
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getBrowserOrigin,
    getServerOrigin,
  );
  const [copied, setCopied] = useState(false);

  const overlayUrl = useMemo(() => {
    if (!origin || (widget === "pubg" && !player.trim())) return "";
    const url = new URL("/overlays/view", origin);
    url.searchParams.set("widget", widget);
    url.searchParams.set("layout", "card");
    url.searchParams.set("refresh", widget === "cs2" ? "2" : "60");
    if (widget === "pubg" && player.trim()) {
      url.searchParams.set("player", player.trim());
    }
    return url.toString();
  }, [origin, player, widget]);

  async function copyUrl() {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch (error) {
      console.error("Could not copy overlay URL:", error);
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Herní overlay pro OBS</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Veřejnou URL můžeš vložit jako Browser Source. Karta se animovaně zobrazí
        u spodního okraje obrazu.
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Hra
          <select
            value={widget}
            onChange={(event) => setWidget(event.target.value as Widget)}
            className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            <option value="cs2">CS2 live stats</option>
            <option value="pubg">PUBG ranked stats za dnešek</option>
          </select>
        </label>
        {widget === "pubg" && (
          <label className="text-sm font-medium">
            PUBG nickname (Steam)
            <input
              value={player}
              onChange={(event) => setPlayer(event.target.value)}
              maxLength={32}
              placeholder="Zadej přesný herní nickname"
              className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="overlay-url" className="text-sm font-medium">
          Veřejná URL pro OBS Browser Source
        </label>
        <input
          id="overlay-url"
          readOnly
          value={overlayUrl}
          className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void copyUrl()}
            disabled={!overlayUrl}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
          >
            {copied ? "Zkopírováno" : "Kopírovat URL"}
          </button>
          {overlayUrl && (
            <a
              href={overlayUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
            >
              Náhled overlaye
            </a>
          )}
        </div>
      </div>
      <p className="mt-5 text-xs text-zinc-500">
        Veřejné herní statistiky: CS2 z Game State Integration a dnešní PUBG ranked statistiky přes oficiální API.
      </p>
    </section>
  );
}
