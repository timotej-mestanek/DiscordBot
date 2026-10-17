import { createServer } from "node:http";
import next from "next";
import { PrismaClient } from "@prisma/client";
import { WebSocket, WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const nextApp = next({ dev, hostname, port });
const prisma = new PrismaClient();
const websocketServer = new WebSocketServer({ noServer: true });
globalThis.__wheelRealtimeListeners = new Set();
globalThis.__wheelRealtimePublish = (event) => {
  for (const listener of globalThis.__wheelRealtimeListeners) listener(event);
};
const server = createServer((request, response) => {
  void nextApp.getRequestHandler()(request, response);
});

function send(socket, event) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

function cursorFromUrl(url) {
  const since = url.searchParams.get("since");
  const after = url.searchParams.get("after") ?? "";
  if (!since || after.length > 100 || !Number.isFinite(Date.parse(since))) {
    return null;
  }
  return { createdAt: new Date(since), id: after };
}

async function getSnapshot() {
  const [profiles, mainProfile] = await Promise.all([
    prisma.wheelProfile.findMany({
      where: { kind: "game" },
      select: { id: true, game_name: true, reset_at: true, config: true },
      orderBy: [{ game_name: "asc" }, { id: "asc" }],
    }),
    prisma.wheelProfile.findUnique({
      where: { id: "main" },
      select: { config: true },
    }),
  ]);
  const spins = profiles.length
    ? await prisma.wheelSpin.findMany({
        where: {
          OR: profiles.map((profile) => ({
            profile_id: profile.id,
            ...(profile.reset_at ? { created_at: { gt: profile.reset_at } } : {}),
          })),
        },
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
        select: {
          id: true,
          profile_id: true,
          display_name: true,
          game_name: true,
          sequence: true,
          created_at: true,
        },
      })
    : [];
  const profileMap = new Map(
    profiles.map((profile) => {
      const config = profile.config;
      if (
        typeof config !== "object" ||
        config === null ||
        Array.isArray(config) ||
        typeof config.maxSpins !== "number" ||
        !Number.isSafeInteger(config.maxSpins) ||
        config.maxSpins < 1
      ) {
        throw new Error(`Wheel profile ${profile.id} has an invalid spin limit.`);
      }
      return [
        profile.id,
        {
          profileId: profile.id,
          gameName: profile.game_name ?? "Herná hra",
          maxSpins: config.maxSpins,
          resetAt: profile.reset_at?.toISOString() ?? null,
          spins: [],
        },
      ];
    }),
  );

  for (const spin of spins) {
    const segment = Array.isArray(spin.sequence) ? spin.sequence[0] : null;
    if (
      typeof segment !== "object" ||
      segment === null ||
      !("selectedLabel" in segment) ||
      typeof segment.selectedLabel !== "string" ||
      !("selectedSliceId" in segment) ||
      typeof segment.selectedSliceId !== "string" ||
      !("durationMs" in segment) ||
      typeof segment.durationMs !== "number" ||
      !("slices" in segment) ||
      !Array.isArray(segment.slices)
    ) {
      throw new Error(`Wheel spin ${spin.id} has an invalid result for history.`);
    }
    const selected = segment.slices.find(
      (slice) =>
        typeof slice === "object" &&
        slice !== null &&
        "id" in slice &&
        slice.id === segment.selectedSliceId &&
        "weight" in slice &&
        typeof slice.weight === "number",
    );
    const totalWeight = segment.slices.reduce(
      (total, slice) =>
        typeof slice === "object" &&
        slice !== null &&
        "weight" in slice &&
        typeof slice.weight === "number"
          ? total + slice.weight
          : total,
      0,
    );
    if (
      !selected ||
      !("weight" in selected) ||
      typeof selected.weight !== "number" ||
      totalWeight <= 0
    ) {
      throw new Error(`Wheel spin ${spin.id} has an invalid selected slice.`);
    }
    profileMap.get(spin.profile_id)?.spins.push({
      id: spin.id,
      displayName: spin.display_name,
      gameName:
        spin.game_name ?? profileMap.get(spin.profile_id)?.gameName ?? "Herná hra",
      result: segment.selectedLabel,
      rarity: selected.weight / totalWeight,
      createdAt: spin.created_at.toISOString(),
      revealAt: new Date(spin.created_at.getTime() + segment.durationMs + 500).toISOString(),
    });
  }

  let wheel = null;
  if (mainProfile) {
    const config = mainProfile.config;
    if (
      typeof config !== "object" ||
      config === null ||
      Array.isArray(config) ||
      typeof config.title !== "string" ||
      !Array.isArray(config.slices)
    ) {
      throw new Error("Main wheel profile has an invalid configuration.");
    }
    if (config.slices.length >= 2) {
      wheel = { title: config.title, slices: config.slices };
    }
  }

  return { type: "snapshot", wheel, profiles: [...profileMap.values()] };
}

async function sendMissedSpins(socket, cursor) {
  let current = cursor;
  while (socket.readyState === WebSocket.OPEN) {
    const page = await prisma.wheelSpin.findMany({
      where: {
        OR: [
          { created_at: { gt: current.createdAt } },
          { created_at: current.createdAt, id: { gt: current.id } },
        ],
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      take: 50,
      select: {
        id: true,
        event_id: true,
        profile_id: true,
        display_name: true,
        game_name: true,
        sequence: true,
        created_at: true,
      },
    });
    for (const spin of page) {
      send(socket, {
        type: "spin",
        spin: { ...spin, created_at: spin.created_at.toISOString() },
      });
      current = { createdAt: spin.created_at, id: spin.id };
    }
    if (page.length < 50) return;
  }
}

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/api/overlays/wheels/live") return;

  const cursor = cursorFromUrl(url);
  if (!cursor) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (client) => {
    websocketServer.emit("connection", client, cursor);
  });
});

websocketServer.on("connection", (socket, cursor) => {
  let initializing = true;
  const bufferedEvents = [];
  const listener = (event) => {
    if (initializing) bufferedEvents.push(event);
    else send(socket, event);
  };
  globalThis.__wheelRealtimeListeners.add(listener);
  socket.once("close", () => globalThis.__wheelRealtimeListeners.delete(listener));

  void (async () => {
    try {
      send(socket, await getSnapshot());
      await sendMissedSpins(socket, cursor);
      while (bufferedEvents.length > 0 && socket.readyState === WebSocket.OPEN) {
        send(socket, bufferedEvents.shift());
      }
      initializing = false;
    } catch (error) {
      console.error("Failed to initialize wheel WebSocket client:", error);
      socket.close(1011, "Wheel history could not be loaded");
    }
  })();
});

await nextApp.prepare();
server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    websocketServer.close();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
