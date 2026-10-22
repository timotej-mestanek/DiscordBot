export type LedEffectKeyframe = {
  time: number;
  color: string;
  opacity: number;
  animation: "steady" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "pulse" | "fill";
  ledIds: number[] | null;
};

export type LedEffect = {
  name: string;
  durationSeconds: number;
  keyframes: LedEffectKeyframe[];
};

const animationCodes: Record<LedEffectKeyframe["animation"], number> = {
  steady: 0,
  linear: 1,
  "ease-in": 2,
  "ease-out": 3,
  "ease-in-out": 4,
  pulse: 5,
  fill: 6,
};

export function encodeLedEffect(effect: LedEffect, requestId: string): Buffer {
  const name = Buffer.from(effect.name, "utf8");
  const frames = [...effect.keyframes].sort((left, right) => left.time - right.time);
  const frameSizes = frames.map(
    (frame) => 9 + (frame.ledIds === null ? 0 : frame.ledIds.length * 2),
  );
  const packet = Buffer.alloc(
    49 + name.length + frameSizes.reduce((total, size) => total + size, 0),
  );

  packet.write("N4LD", 0, "ascii");
  packet.writeUInt8(1, 4);
  packet.writeUInt8(1, 5);
  packet.writeUInt16LE(effect.durationSeconds * 1_000, 6);
  packet.writeUInt16LE(333, 8);
  packet.writeUInt16LE(frames.length, 10);
  packet.write(requestId, 12, 36, "ascii");
  packet.writeUInt8(name.length, 48);
  name.copy(packet, 49);

  let offset = 49 + name.length;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    packet.writeUInt16LE(Math.round((frame.time * 1_000) / 60), offset);
    packet.writeUInt8(Number.parseInt(frame.color.slice(1, 3), 16), offset + 2);
    packet.writeUInt8(Number.parseInt(frame.color.slice(3, 5), 16), offset + 3);
    packet.writeUInt8(Number.parseInt(frame.color.slice(5, 7), 16), offset + 4);
    packet.writeUInt8(Math.round(frame.opacity * 255), offset + 5);
    packet.writeUInt8(animationCodes[frame.animation], offset + 6);
    if (frame.ledIds === null) {
      packet.writeUInt16LE(0xffff, offset + 7);
      offset += 9;
      continue;
    }
    packet.writeUInt16LE(frame.ledIds.length, offset + 7);
    offset += 9;
    for (const ledId of [...frame.ledIds].sort((left, right) => left - right)) {
      packet.writeUInt16LE(ledId, offset);
      offset += 2;
    }
  }
  return packet;
}

declare global {
  var __ledRealtimeIsConnected: (() => boolean) | undefined;
  var __ledRealtimePublish:
    | ((packet: Buffer, requestId: string) => Promise<void>)
    | undefined;
}

export function isLedBridgeConnected(): boolean {
  return globalThis.__ledRealtimeIsConnected?.() ?? false;
}

export async function publishLedEffect(packet: Buffer, requestId: string): Promise<void> {
  if (!globalThis.__ledRealtimePublish) {
    throw new Error("The LED bridge WebSocket server is unavailable.");
  }
  await globalThis.__ledRealtimePublish(packet, requestId);
}
