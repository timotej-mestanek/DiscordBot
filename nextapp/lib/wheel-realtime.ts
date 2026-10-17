import type { WheelSlice } from "@/lib/wheels";

export type WheelRealtimeSpin = {
  id: string;
  event_id: string;
  profile_id: string;
  display_name: string;
  game_name: string | null;
  sequence: unknown;
  created_at: string;
};

export type WheelHistoryCard = {
  id: string;
  displayName: string;
  gameName: string;
  result: string;
  rarity: number;
  createdAt: string;
  revealAt: string;
};

export type WheelRealtimeEvent =
  | { type: "spin"; spin: WheelRealtimeSpin }
  | { type: "reset"; profileId: string; resetAt: string }
  | {
      type: "snapshot";
      wheel: { title: string; slices: WheelSlice[] } | null;
      profiles: {
        profileId: string;
        gameName: string;
        maxSpins: number;
        resetAt: string | null;
        spins: WheelHistoryCard[];
      }[];
    };

declare global {
  var __wheelRealtimePublish: ((event: WheelRealtimeEvent) => void) | undefined;
}

export function publishWheelRealtimeEvent(event: WheelRealtimeEvent): void {
  if (!globalThis.__wheelRealtimePublish) {
    console.error("Wheel WebSocket server is unavailable; realtime event was not broadcast.");
    return;
  }
  globalThis.__wheelRealtimePublish(event);
}
