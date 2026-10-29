import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import next from "next";
import { PrismaClient } from "@prisma/client";
import { WebSocket, WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const nextApp = next({ dev, hostname, port });
const prisma = new PrismaClient();
const websocketServer = new WebSocketServer({ noServer: true });
let ledBridgeSocket = null;
const ledPendingAcks = new Map();
let shopBridgeSocket = null;
const shopPendingAcks = new Map();
const shopRetryAfter = new Map();
let pumpingShopDeliveries = false;
globalThis.__wheelRealtimeListeners = new Set();
globalThis.__wheelRealtimePublish = (event) => {
  for (const listener of globalThis.__wheelRealtimeListeners) listener(event);
};
globalThis.__streamOverlayListeners = new Set();
globalThis.__streamOverlayTimerEventIds = new Set();
globalThis.__streamOverlayState = {
  type: "snapshot",
  timer: null,
  voting: null,
  alert: null,
};
globalThis.__streamOverlayPublish = (event) => {
  if (
    event.type === "timer" &&
    globalThis.__streamOverlayTimerEventIds.has(event.eventId)
  ) {
    return false;
  }
  if (event.type === "timer") {
    globalThis.__streamOverlayTimerEventIds.add(event.eventId);
    if (globalThis.__streamOverlayTimerEventIds.size > 500) {
      const oldest = globalThis.__streamOverlayTimerEventIds.values().next().value;
      if (oldest) globalThis.__streamOverlayTimerEventIds.delete(oldest);
    }
    globalThis.__streamOverlayState.timer = event;
  } else if (event.type === "voting") {
    globalThis.__streamOverlayState.voting = event;
  } else {
    globalThis.__streamOverlayState.alert = event.active ? event : null;
  }
  for (const listener of globalThis.__streamOverlayListeners) listener(event);
  return true;
};
const server = createServer((request, response) => {
  void nextApp.getRequestHandler()(request, response);
});

globalThis.__ledRealtimeIsConnected = () =>
  ledBridgeSocket?.readyState === WebSocket.OPEN;
globalThis.__ledRealtimePublish = (packet, requestId) =>
  new Promise((resolve, reject) => {
    if (!globalThis.__ledRealtimeIsConnected()) {
      reject(new Error("Streamer.bot LED bridge is not connected."));
      return;
    }

    const socket = ledBridgeSocket;
    const timeout = setTimeout(() => {
      ledPendingAcks.delete(requestId);
      reject(new Error("Streamer.bot did not acknowledge the LED effect in time."));
    }, 15_000);
    ledPendingAcks.set(requestId, {
      socket,
      resolve: () => {
        clearTimeout(timeout);
        ledPendingAcks.delete(requestId);
        resolve();
      },
      reject: (error) => {
        clearTimeout(timeout);
        ledPendingAcks.delete(requestId);
        reject(error);
      },
    });
    socket.send(packet, { binary: true }, (error) => {
      if (!error) return;
      ledPendingAcks.get(requestId)?.reject(error);
    });
  });

function scheduleShopDeliveryRetry(eventId, socket, error) {
  const pending = shopPendingAcks.get(eventId);
  if (!pending || pending.socket !== socket) return;
  clearTimeout(pending.timeout);
  shopPendingAcks.delete(eventId);
  void prisma.shopDeliveryEvent.updateMany({
    where: { event_id: eventId, delivered_at: null },
    data: { last_error: error },
  }).catch((updateError) => {
    console.error("Failed to save Streamer.bot shop delivery error:", eventId, updateError);
  });
  if (shopBridgeSocket === socket && socket.readyState === WebSocket.OPEN) {
    const retryAt = Date.now() + 30_000;
    shopRetryAfter.set(eventId, retryAt);
    setTimeout(() => {
      if (shopRetryAfter.get(eventId) === retryAt) {
        shopRetryAfter.delete(eventId);
        void pumpShopDeliveries();
      }
    }, 30_000);
  }
}

async function pumpShopDeliveries() {
  if (
    pumpingShopDeliveries ||
    !shopBridgeSocket ||
    shopBridgeSocket.readyState !== WebSocket.OPEN
  ) {
    return;
  }
  pumpingShopDeliveries = true;
  try {
    const socket = shopBridgeSocket;
    const events = await prisma.shopDeliveryEvent.findMany({
      where: { delivered_at: null, cancelled_at: null },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      take: 50,
    });
    for (const event of events) {
      if (socket !== shopBridgeSocket || socket.readyState !== WebSocket.OPEN) return;
      if (shopPendingAcks.has(event.event_id)) continue;
      if ((shopRetryAfter.get(event.event_id) ?? 0) > Date.now()) continue;
      const claimed = await prisma.shopDeliveryEvent.updateMany({
        where: { id: event.id, delivered_at: null, cancelled_at: null },
        data: { attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;
      const timeout = setTimeout(() => {
        scheduleShopDeliveryRetry(
          event.event_id,
          socket,
          "Streamer.bot acknowledgement timed out.",
        );
      }, 30_000);
      shopPendingAcks.set(event.event_id, { socket, timeout });
      socket.send(JSON.stringify(event.payload), (error) => {
        if (error) {
          scheduleShopDeliveryRetry(event.event_id, socket, error.message);
          return;
        }
        console.log("Streamer.bot shop event delivered to bridge:", event.event_id);
      });
    }
  } catch (error) {
    console.error("Failed to dispatch queued shop events:", error);
    setTimeout(() => void pumpShopDeliveries(), 5_000);
  } finally {
    pumpingShopDeliveries = false;
  }
}

const shopDeliveryPoll = setInterval(() => {
  void pumpShopDeliveries();
}, 3_000);

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
    const probabilityFor = (slice) => {
      if (typeof slice !== "object" || slice === null) return null;
      if ("probability" in slice && typeof slice.probability === "number") {
        return slice.probability;
      }
      return "weight" in slice && typeof slice.weight === "number"
        ? slice.weight
        : null;
    };
    const selected = segment.slices.find(
      (slice) =>
        typeof slice === "object" &&
        slice !== null &&
        "id" in slice &&
        slice.id === segment.selectedSliceId &&
        probabilityFor(slice) !== null,
    );
    const totalProbability = segment.slices.reduce(
      (total, slice) => total + (probabilityFor(slice) ?? 0),
      0,
    );
    const selectedProbability = probabilityFor(selected);
    if (
      selectedProbability === null ||
      totalProbability <= 0
    ) {
      throw new Error(`Wheel spin ${spin.id} has an invalid selected slice.`);
    }
    profileMap.get(spin.profile_id)?.spins.push({
      id: spin.id,
      displayName: spin.display_name,
      gameName:
        spin.game_name ?? profileMap.get(spin.profile_id)?.gameName ?? "Herná hra",
      result: segment.selectedLabel,
      rarity: selectedProbability / totalProbability,
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
    if (config.enabled === true && config.slices.length >= 2) {
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
  if (url.pathname === "/api/overlays/stream/live") {
    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit("connection", client, { channel: "stream" });
    });
    return;
  }
  if (url.pathname === "/api/integrations/streamerbot/led/live") {
    const expectedToken = process.env.STREAMERBOT_INGEST_TOKEN;
    const authorization = request.headers.authorization ?? "";
    const suppliedToken = Buffer.from(
      authorization.startsWith("Bearer ") ? authorization.slice(7) : "",
    );
    const expected = Buffer.from(expectedToken ?? "");
    if (!expectedToken) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    if (
      suppliedToken.length !== expected.length ||
      !timingSafeEqual(suppliedToken, expected)
    ) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    if (globalThis.__ledRealtimeIsConnected()) {
      socket.write("HTTP/1.1 409 Conflict\r\n\r\n");
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit("connection", client, { channel: "led" });
    });
    return;
  }
  if (url.pathname === "/api/integrations/streamerbot/shop/live") {
    const expectedToken = process.env.STREAMERBOT_INGEST_TOKEN;
    const authorization = request.headers.authorization ?? "";
    const suppliedToken = Buffer.from(
      authorization.startsWith("Bearer ") ? authorization.slice(7) : "",
    );
    const expected = Buffer.from(expectedToken ?? "");
    if (!expectedToken) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    if (
      suppliedToken.length !== expected.length ||
      !timingSafeEqual(suppliedToken, expected)
    ) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    if (shopBridgeSocket?.readyState === WebSocket.OPEN) {
      socket.write("HTTP/1.1 409 Conflict\r\n\r\n");
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit("connection", client, { channel: "shop" });
    });
    return;
  }
  if (url.pathname !== "/api/overlays/wheels/live") return;

  const cursor = cursorFromUrl(url);
  if (!cursor) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (client) => {
    websocketServer.emit("connection", client, { channel: "wheel", cursor });
  });
});

websocketServer.on("connection", (socket, context) => {
  if (context.channel === "led") {
    ledBridgeSocket = socket;
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        socket.close(1003, "Only text acknowledgements are accepted");
        return;
      }
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        socket.close(1007, "Invalid acknowledgement");
        return;
      }
      if (
        message?.type !== "led-ack" ||
        typeof message.id !== "string" ||
        typeof message.ok !== "boolean"
      ) {
        socket.close(1007, "Invalid acknowledgement");
        return;
      }
      const pending = ledPendingAcks.get(message.id);
      if (!pending || pending.socket !== socket) return;
      if (message.ok) pending.resolve();
      else pending.reject(new Error("Streamer.bot could not deliver the LED effect."));
    });
    socket.once("close", () => {
      if (ledBridgeSocket === socket) ledBridgeSocket = null;
      for (const [requestId, pending] of ledPendingAcks) {
        if (pending.socket === socket) {
          pending.reject(new Error("Streamer.bot LED bridge disconnected."));
          ledPendingAcks.delete(requestId);
        }
      }
    });
    return;
  }
  if (context.channel === "shop") {
    shopBridgeSocket = socket;
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        socket.close(1003, "Only JSON acknowledgements are accepted");
        return;
      }
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        socket.close(1007, "Invalid acknowledgement");
        return;
      }
      if (
        message?.type !== "shop-ack" ||
        typeof message.eventId !== "string" ||
        typeof message.ok !== "boolean"
      ) {
        socket.close(1007, "Invalid acknowledgement");
        return;
      }

      const pending = shopPendingAcks.get(message.eventId);
      if (!pending || pending.socket !== socket) return;
      clearTimeout(pending.timeout);
      if (message.ok) {
        shopPendingAcks.delete(message.eventId);
        shopRetryAfter.delete(message.eventId);
        void prisma.shopDeliveryEvent.updateMany({
          where: { event_id: message.eventId, delivered_at: null },
          data: { delivered_at: new Date(), last_error: null },
        }).then((result) => {
          if (result.count > 0) {
            console.log("Streamer.bot confirmed shop event:", message.eventId);
          }
        }).catch((error) => {
          console.error("Failed to save Streamer.bot shop acknowledgement:", message.eventId, error);
        }).finally(() => void pumpShopDeliveries());
      } else {
        scheduleShopDeliveryRetry(
          message.eventId,
          socket,
          typeof message.error === "string"
            ? message.error.slice(0, 500)
            : "Streamer.bot rejected the shop event.",
        );
      }
    });
    socket.once("close", () => {
      if (shopBridgeSocket === socket) shopBridgeSocket = null;
      for (const [eventId, pending] of shopPendingAcks) {
        if (pending.socket !== socket) continue;
        clearTimeout(pending.timeout);
        shopPendingAcks.delete(eventId);
        void prisma.shopDeliveryEvent.updateMany({
          where: { event_id: eventId, delivered_at: null },
          data: { last_error: "Streamer.bot shop bridge disconnected before acknowledgement." },
        }).catch((error) => {
          console.error("Failed to save interrupted shop delivery:", eventId, error);
        });
      }
    });
    void pumpShopDeliveries();
    return;
  }
  if (context.channel === "stream") {
    const listener = (event) => send(socket, event);
    globalThis.__streamOverlayListeners.add(listener);
    socket.once("close", () => globalThis.__streamOverlayListeners.delete(listener));
    send(socket, globalThis.__streamOverlayState);
    return;
  }

  const { cursor } = context;
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
    clearInterval(shopDeliveryPoll);
    for (const pending of shopPendingAcks.values()) clearTimeout(pending.timeout);
    shopRetryAfter.clear();
    websocketServer.close();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
