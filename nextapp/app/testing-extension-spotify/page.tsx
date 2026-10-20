"use client";

import { useEffect, useRef, useState } from "react";

const PUBLISH_INTERVAL_MS = 10_000;

export default function TestingSpotifyExtensionPage() {
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState("Test broadcasts are stopped.");
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(
    () => () => {
      activeRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  async function publishTestTrack() {
    try {
      const response = await fetch("/api/testing-extension-spotify", {
        method: "POST",
        cache: "no-store",
      });
      const result: { error?: string; retryAfterMs?: number; track?: string } =
        await response.json();

      if (response.status === 429 && typeof result.retryAfterMs === "number") {
        if (!activeRef.current) return;
        setStatus(`Rate limited. Retrying in ${Math.ceil(result.retryAfterMs / 1_000)} seconds.`);
        timerRef.current = window.setTimeout(
          () => void publishTestTrack(),
          result.retryAfterMs,
        );
        return;
      }
      if (!response.ok) {
        throw new Error(result.error ?? `Request failed (${response.status}).`);
      }

      setStatus(`Sending test data: ${result.track ?? "sample track"}.`);
    } catch (error) {
      activeRef.current = false;
      setIsTesting(false);
      setStatus(error instanceof Error ? error.message : "Could not send test data.");
      return;
    }

    if (activeRef.current) {
      timerRef.current = window.setTimeout(
        () => void publishTestTrack(),
        PUBLISH_INTERVAL_MS,
      );
    }
  }

  function startTesting() {
    if (activeRef.current) return;
    activeRef.current = true;
    setIsTesting(true);
    setStatus("Starting test broadcasts…");
    void publishTestTrack();
  }

  function stopTesting() {
    activeRef.current = false;
    setIsTesting(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStatus("Test broadcasts are stopped.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-5 px-6 py-12 text-zinc-100">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
        Spotify Extension
      </p>
      <h1 className="text-3xl font-bold">Test broadcasts</h1>
      <p className="text-zinc-400">
        Send a sample track to the Extension even when Spotify is disconnected
        and the stream is offline. Keep this page open while testing.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={startTesting}
          disabled={isTesting}
          className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start testing
        </button>
        <button
          type="button"
          onClick={stopTesting}
          disabled={!isTesting}
          className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop testing
        </button>
      </div>
      <p className="min-h-6 text-sm text-zinc-300" role="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
