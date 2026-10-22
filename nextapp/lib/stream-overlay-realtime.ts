export type StreamTimerEvent = {
  type: "timer";
  eventId: string;
  durationSeconds: number;
  startedAt: string;
  title: string;
};

export type StreamVotingOption = {
  id: string;
  label: string;
  votes: number;
};

export type StreamVotingEvent = {
  type: "voting";
  eventId: string;
  active: boolean;
  question: string;
  options: StreamVotingOption[];
};

export type StreamAlertSeverity = "info" | "attention" | "warning" | "critical";

export type StreamAlertEvent = {
  type: "alert";
  eventId: string;
  active: true;
  severity: StreamAlertSeverity;
  title: string;
  message: string;
};

export type StreamAlertHideEvent = {
  type: "alert";
  eventId: string;
  active: false;
};

export type StreamOverlayEvent =
  | StreamTimerEvent
  | StreamVotingEvent
  | StreamAlertEvent
  | StreamAlertHideEvent;

export type StreamOverlaySnapshot = {
  type: "snapshot";
  timer: StreamTimerEvent | null;
  voting: StreamVotingEvent | null;
  alert: StreamAlertEvent | null;
};

export type StreamOverlayMessage = StreamOverlayEvent | StreamOverlaySnapshot;

declare global {
  var __streamOverlayPublish:
    | ((event: StreamOverlayEvent) => boolean)
    | undefined;
}

export function publishStreamOverlayEvent(event: StreamOverlayEvent): boolean {
  if (!globalThis.__streamOverlayPublish) {
    throw new Error("Stream overlay WebSocket server is unavailable.");
  }
  return globalThis.__streamOverlayPublish(event);
}
