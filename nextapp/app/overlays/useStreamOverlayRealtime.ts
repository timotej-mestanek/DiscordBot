"use client";

import { useEffect, useRef } from "react";
import type {
  StreamOverlayMessage,
  StreamAlertEvent,
  StreamTimerEvent,
  StreamVotingEvent,
} from "@/lib/stream-overlay-realtime";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimerEvent(value: unknown): value is StreamTimerEvent {
  return (
    isRecord(value) &&
    value.type === "timer" &&
    typeof value.eventId === "string" &&
    typeof value.durationSeconds === "number" &&
    Number.isSafeInteger(value.durationSeconds) &&
    value.durationSeconds > 0 &&
    typeof value.startedAt === "string" &&
    Number.isFinite(Date.parse(value.startedAt)) &&
    typeof value.title === "string"
  );
}

function isVotingEvent(value: unknown): value is StreamVotingEvent {
  return (
    isRecord(value) &&
    value.type === "voting" &&
    typeof value.eventId === "string" &&
    typeof value.active === "boolean" &&
    typeof value.question === "string" &&
    Array.isArray(value.options) &&
    value.options.every(
      (option) =>
        isRecord(option) &&
        typeof option.id === "string" &&
        typeof option.label === "string" &&
        typeof option.votes === "number" &&
        Number.isSafeInteger(option.votes) &&
        option.votes >= 0,
    )
  );
}

function isAlertEvent(value: unknown): value is StreamAlertEvent {
  return (
    isRecord(value) &&
    value.type === "alert" &&
    typeof value.eventId === "string" &&
    value.active === true &&
    (value.severity === "info" ||
      value.severity === "attention" ||
      value.severity === "warning" ||
      value.severity === "critical") &&
    typeof value.title === "string" &&
    typeof value.message === "string"
  );
}

function isStreamOverlayMessage(value: unknown): value is StreamOverlayMessage {
  if (!isRecord(value)) return false;
  if (value.type === "timer") return isTimerEvent(value);
  if (value.type === "voting") return isVotingEvent(value);
  if (value.type === "alert") {
    return (
      (value.active === false &&
        typeof value.eventId === "string") ||
      isAlertEvent(value)
    );
  }
  return (
    value.type === "snapshot" &&
    (value.timer === null || isTimerEvent(value.timer)) &&
    (value.voting === null || isVotingEvent(value.voting)) &&
    (value.alert === null || isAlertEvent(value.alert))
  );
}

export default function useStreamOverlayRealtime(
  onEvent: (event: StreamOverlayMessage) => void,
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

    const connect = () => {
      if (disposed) return;
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(
        "/api/overlays/stream/live",
        `${scheme}//${window.location.host}`,
      );
      socket = new WebSocket(url);
      socket.onopen = () => {
        attempts = 0;
      };
      socket.onmessage = (message) => {
        try {
          const event: unknown = JSON.parse(message.data);
          if (!isStreamOverlayMessage(event)) {
            throw new Error("Server sent an invalid stream overlay message.");
          }
          onEventRef.current(event);
        } catch (error) {
          console.error("Stream overlay WebSocket message failed:", error);
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
