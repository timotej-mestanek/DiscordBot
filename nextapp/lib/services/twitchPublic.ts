export type TwitchClip = {
  title: string;
  url: string;
  thumbnail_url: string;
  view_count: number;
  creator_name: string;
};

export type TwitchLiveStatus = {
  isLive: boolean;
  title: string | null;
  startedAt: string | null;
  gameId: string | null;
  gameName: string | null;
};

let cachedAppToken: { token: string; expiresAt: number } | null = null;
let cachedTopClip: { clip: TwitchClip | null; expiresAt: number } | null = null;
let cachedLiveStatus: { status: TwitchLiveStatus; expiresAt: number } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function getAppToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 60_000) {
    return cachedAppToken.token;
  }
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Twitch app credentials.");

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const body: unknown = await response.json();
  if (
    !response.ok ||
    !isRecord(body) ||
    typeof body.access_token !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    console.error("Twitch app token request failed:", response.status);
    throw new Error("Twitch app token request failed.");
  }
  cachedAppToken = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return body.access_token;
}

export async function getTwitchUserNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return names;
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error("Missing Twitch app client ID.");
  const token = await getAppToken();

  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const url = new URL("https://api.twitch.tv/helix/users");
    for (const id of uniqueIds.slice(offset, offset + 100)) {
      url.searchParams.append("id", id);
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": clientId,
      },
    });
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body) || !Array.isArray(body.data)) {
      console.error("Twitch leaderboard name lookup failed:", response.status);
      throw new Error("Twitch leaderboard name lookup failed.");
    }
    for (const user of body.data) {
      if (!isRecord(user) || typeof user.id !== "string") continue;
      const name =
        typeof user.display_name === "string"
          ? user.display_name
          : typeof user.login === "string"
            ? user.login
            : null;
      if (name) names.set(user.id, name);
    }
  }
  return names;
}

export async function getTopTwitchClip(): Promise<TwitchClip | null> {
  if (cachedTopClip && cachedTopClip.expiresAt > Date.now()) {
    return cachedTopClip.clip;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error("Missing Twitch app client ID.");
  const login = process.env.TWITCH_BROADCASTER_LOGIN?.trim() || "n4jtik";
  const token = await getAppToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Client-Id": clientId,
  };
  const userUrl = new URL("https://api.twitch.tv/helix/users");
  userUrl.searchParams.set("login", login);
  const userResponse = await fetch(userUrl, { headers });
  const userBody: unknown = await userResponse.json();
  if (!userResponse.ok || !isRecord(userBody) || !Array.isArray(userBody.data)) {
    console.error("Twitch broadcaster lookup failed:", userResponse.status);
    throw new Error("Twitch broadcaster lookup failed.");
  }
  const broadcaster = userBody.data[0];
  if (!isRecord(broadcaster) || typeof broadcaster.id !== "string") {
    cachedTopClip = { clip: null, expiresAt: Date.now() + 60_000 };
    return null;
  }

  const clipsUrl = new URL("https://api.twitch.tv/helix/clips");
  clipsUrl.searchParams.set("broadcaster_id", broadcaster.id);
  clipsUrl.searchParams.set("first", "100");
  const clipsResponse = await fetch(clipsUrl, { headers });
  const clipsBody: unknown = await clipsResponse.json();
  if (!clipsResponse.ok || !isRecord(clipsBody) || !Array.isArray(clipsBody.data)) {
    console.error("Twitch clips lookup failed:", clipsResponse.status);
    throw new Error("Twitch clips lookup failed.");
  }

  const clips = clipsBody.data.filter(
    (clip): clip is TwitchClip =>
      isRecord(clip) &&
      typeof clip.title === "string" &&
      typeof clip.url === "string" &&
      typeof clip.thumbnail_url === "string" &&
      typeof clip.view_count === "number" &&
      typeof clip.creator_name === "string",
  );
  const topClip = clips.sort((left, right) => right.view_count - left.view_count)[0];
  const result = topClip
    ? {
        title: topClip.title,
        url: topClip.url,
        thumbnail_url: topClip.thumbnail_url,
        view_count: topClip.view_count,
        creator_name: topClip.creator_name,
      }
    : null;
  cachedTopClip = { clip: result, expiresAt: Date.now() + 60_000 };
  return result;
}

export async function getTwitchLiveStatus(): Promise<TwitchLiveStatus> {
  if (cachedLiveStatus && cachedLiveStatus.expiresAt > Date.now()) {
    return cachedLiveStatus.status;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error("Missing Twitch app client ID.");
  const login = process.env.TWITCH_BROADCASTER_LOGIN?.trim() || "n4jtik";
  const token = await getAppToken();
  const url = new URL("https://api.twitch.tv/helix/streams");
  url.searchParams.set("user_login", login);
  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token,
      "Client-Id": clientId,
    },
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (
    !response.ok ||
    !isRecord(body) ||
    !Array.isArray(body.data)
  ) {
    console.error("Twitch live status request failed:", response.status);
    throw new Error("Twitch live status request failed.");
  }

  const stream = body.data[0];
  const status: TwitchLiveStatus =
    isRecord(stream) &&
    typeof stream.title === "string" &&
    typeof stream.started_at === "string"
      ? {
          isLive: true,
          title: stream.title,
          startedAt: stream.started_at,
          gameId: typeof stream.game_id === "string" ? stream.game_id : null,
          gameName: typeof stream.game_name === "string" ? stream.game_name : null,
        }
      : {
          isLive: false,
          title: null,
          startedAt: null,
          gameId: null,
          gameName: null,
        };

  cachedLiveStatus = { status, expiresAt: Date.now() + 30_000 };
  return status;
}
