"use client";

import { useCallback, useEffect, useState } from "react";

export type LivePointBalances = {
  discord: number | null;
  twitchCustom: number | null;
};

function isPointBalance(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  );
}

export function useLivePointBalances(initial: LivePointBalances) {
  const [balances, setBalances] = useState(initial);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/points", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Point balance refresh failed with HTTP ${response.status}.`);
      }
      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("discord" in result) ||
        !("twitchCustom" in result) ||
        !isPointBalance(result.discord) ||
        !isPointBalance(result.twitchCustom)
      ) {
        throw new Error("Point balance refresh returned an invalid response.");
      }
      setBalances({
        discord: result.discord,
        twitchCustom: result.twitchCustom,
      });
      setError("");
    } catch (refreshError) {
      console.error("Live point balance refresh failed:", refreshError);
      setError("Unable to refresh your live point balance.");
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  return { balances, error };
}
