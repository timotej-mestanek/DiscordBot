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

export type StreamOverlayEvent = StreamTimerEvent | StreamVotingEvent;

export type StreamOverlaySnapshot = {
  type: "snapshot";
  timer: StreamTimerEvent | null;
  voting: StreamVotingEvent | null;
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
