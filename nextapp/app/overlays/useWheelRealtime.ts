"use client";

import { useEffect, useRef } from "react";
import type { WheelRealtimeEvent } from "@/lib/wheel-realtime";

export default function useWheelRealtime(
  onEvent: (event: WheelRealtimeEvent) => void,
) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | null = null;
    let socket: WebSocket | null = null;
    let attempts = 0;
    let cursorDate = new Date().toISOString();
    let cursorId = "";

    const connect = () => {
      if (disposed) return;
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL("/api/overlays/wheels/live", `${scheme}//${window.location.host}`);
      url.searchParams.set("since", cursorDate);
      url.searchParams.set("after", cursorId);
      socket = new WebSocket(url);

      socket.onopen = () => {
        attempts = 0;
      };
      socket.onmessage = (message) => {
        try {
          const event: unknown = JSON.parse(message.data);
          if (
            typeof event !== "object" ||
            event === null ||
            !("type" in event) ||
            (event.type !== "spin" &&
              event.type !== "reset" &&
              event.type !== "snapshot")
          ) {
            throw new Error("Server sent an invalid wheel realtime message.");
          }
          if (event.type === "spin") {
            if (
              !("spin" in event) ||
              typeof event.spin !== "object" ||
              event.spin === null ||
              !("created_at" in event.spin) ||
              typeof event.spin.created_at !== "string" ||
              !("id" in event.spin) ||
              typeof event.spin.id !== "string"
            ) {
              throw new Error("Server sent an invalid wheel spin event.");
            }
            const createdAt = Date.parse(event.spin.created_at);
            if (!Number.isFinite(createdAt)) {
              throw new Error("Server sent a wheel spin with an invalid timestamp.");
            }
            const currentDate = Date.parse(cursorDate);
            if (
              createdAt > currentDate ||
              (createdAt === currentDate && event.spin.id > cursorId)
            ) {
              cursorDate = new Date(createdAt).toISOString();
              cursorId = event.spin.id;
            }
          }
          onEventRef.current(event as WheelRealtimeEvent);
        } catch (error) {
          console.error("Wheel WebSocket message failed:", error);
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        const delay = Math.min(1_000 * 2 ** attempts, 15_000);
        attempts += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);
}
