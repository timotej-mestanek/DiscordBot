import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createPendingDiscordLink,
  matchesDiscordOAuthState,
} from "@/lib/oauth/discordState";
import { syncDiscordNickname } from "@/lib/discord/syncNickname";

type DiscordConnection = {
  id: string;
  name: string;
  type: string;
  revoked?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDiscordConnection(value: unknown): value is DiscordConnection {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    (value.revoked === undefined || typeof value.revoked === "boolean")
  );
}

function resultPage(message: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Propojení Twitch</title><body><main><h1>Propojení Twitch účtu</h1><p>${message}</p></main></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

function clearStateCookie(
  response: NextResponse,
  pendingDiscordId?: string,
): NextResponse {
  response.cookies.set("discord_connections_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/discord/connections",
    maxAge: 0,
  });
  response.cookies.set("discord_twitch_pending", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/twitch/link",
    maxAge: 0,
  });
  response.cookies.set("discord_link_mode", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/discord/connections/callback",
    maxAge: 0,
  });
  if (pendingDiscordId) {
    const secret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
    if (!secret) throw new Error("Missing Discord OAuth client secret.");
    response.cookies.set(
      "discord_twitch_pending",
      createPendingDiscordLink(pendingDiscordId, secret),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth/twitch/link",
        maxAge: 600,
      },
    );
  }
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const cookieState = request.cookies.get("discord_connections_state")?.value;
  if (!matchesDiscordOAuthState(state, cookieState)) {
    return clearStateCookie(
      resultPage("Požadavek vypršel nebo není platný. Vrať se na web a zkus propojení znovu.", 400),
    );
  }

  const code = params.get("code");
  if (params.has("error") || !code) {
    return clearStateCookie(
      resultPage("Přístup nebyl povolen. Pokud chceš účty propojit, spusť akci znovu na webu.", 400),
    );
  }

  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID;
  const clientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Missing Discord OAuth client configuration.");
    return clearStateCookie(
      resultPage("Discord propojení není nakonfigurované.", 500),
    );
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenBody: unknown = await tokenResponse.json();
  if (
    !tokenResponse.ok ||
    !isRecord(tokenBody) ||
    typeof tokenBody.access_token !== "string"
  ) {
    console.error("Discord OAuth token exchange failed:", tokenResponse.status);
    return clearStateCookie(
      resultPage("Discord autorizaci se nepodařilo ověřit. Zkus propojení znovu.", 502),
    );
  }

  const headers = { Authorization: `Bearer ${tokenBody.access_token}` };
  const userResponse = await fetch("https://discord.com/api/users/@me", { headers });
  const isLocalTwitchFlow =
    request.cookies.get("discord_link_mode")?.value === "twitch_oauth";
  const connectionsResponse = isLocalTwitchFlow
    ? null
    : await fetch("https://discord.com/api/users/@me/connections", { headers });
  if (
    !userResponse.ok ||
    (connectionsResponse !== null && !connectionsResponse.ok)
  ) {
    console.error(
      "Discord profile/connections lookup failed:",
      userResponse.status,
      connectionsResponse?.status,
    );
    return clearStateCookie(
      resultPage("Discord nevrátil propojené účty. Zkus propojení znovu.", 502),
    );
  }
  const userBody: unknown = await userResponse.json();
  if (!isRecord(userBody) || typeof userBody.id !== "string") {
    return clearStateCookie(
      resultPage("Discord účet se nepodařilo ověřit.", 502),
    );
  }
  if (isLocalTwitchFlow) {
    const response = NextResponse.redirect(
      new URL("/api/auth/twitch/link", request.url),
    );
    return clearStateCookie(response, userBody.id);
  }
  if (!connectionsResponse) {
    throw new Error("Discord connections response was not requested.");
  }
  const connectionsBody: unknown = await connectionsResponse.json();
  if (!Array.isArray(connectionsBody)) {
    console.error("Discord returned an unexpected connections response.");
    return clearStateCookie(
      resultPage("Discord vrátil neplatný seznam propojených účtů.", 502),
    );
  }

  const twitchConnection = connectionsBody
    .filter(isDiscordConnection)
    .find(
      (connection) =>
        connection.type === "twitch" &&
        connection.revoked !== true &&
        connection.id.length > 0 &&
        connection.name.trim().length > 0,
    );
  if (!twitchConnection) {
    const response = resultPage(
      `V Discord Connections není připojený Twitch účet. Zkus místo toho <a href="/api/auth/discord/local">samostatné ověření přes Twitch</a>.`,
    );
    return clearStateCookie(response);
  }
  const discordName =
    typeof userBody.global_name === "string" && userBody.global_name.trim()
      ? userBody.global_name.trim()
      : typeof userBody.username === "string" && userBody.username.trim()
        ? userBody.username.trim()
        : userBody.id;

  const linkedElsewhere = await prisma.discordTwitchConnection.findUnique({
    where: { twitch_id: twitchConnection.id },
    select: { discord_id: true },
  });
  if (linkedElsewhere && linkedElsewhere.discord_id !== userBody.id) {
    return clearStateCookie(
      resultPage("Tento Twitch účet už je propojený s jiným Discord účtem.", 409),
    );
  }

  try {
    await prisma.discordTwitchConnection.upsert({
      where: { discord_id: userBody.id },
      create: {
        discord_id: userBody.id,
        twitch_id: twitchConnection.id,
        twitch_name: twitchConnection.name.trim(),
        verification_method: "discord_connection",
      },
      update: {
        twitch_id: twitchConnection.id,
        twitch_name: twitchConnection.name.trim(),
        verification_method: "discord_connection",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return clearStateCookie(
        resultPage("Tento Twitch účet už je propojený s jiným Discord účtem.", 409),
      );
    }
    throw error;
  }

  const nicknameErrors = await syncDiscordNickname(
    userBody.id,
    discordName,
    twitchConnection.name.trim(),
  );
  const nicknameMessage = nicknameErrors.length
    ? " Twitch účet je propojený, ale přezdívku se nepodařilo aktualizovat. Zkontroluj oprávnění bota a jeho konfiguraci."
    : " Bot aktualizoval přezdívku na Discordu.";
  return clearStateCookie(
    resultPage(`Twitch účet byl ověřen a propojen s tímto Discord účtem.${nicknameMessage}`),
  );
}
