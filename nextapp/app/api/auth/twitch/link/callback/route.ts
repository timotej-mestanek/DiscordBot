import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  matchesDiscordOAuthState,
  readPendingDiscordLink,
} from "@/lib/oauth/discordState";
import { syncDiscordNickname } from "@/lib/discord/syncNickname";

type TwitchUser = { id: string; login: string; display_name?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTwitchUser(value: unknown): value is TwitchUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    /^\d+$/.test(value.id) &&
    typeof value.login === "string" &&
    value.login.length > 0 &&
    (value.display_name === undefined ||
      typeof value.display_name === "string")
  );
}

function resultPage(message: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ověření Twitch</title><body><main><h1>Ověření Twitch účtu</h1><p>${message}</p><p><a href="/">Zpět na web</a></p></main></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

function clearOAuthCookies(response: NextResponse, clearPending = false): NextResponse {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/twitch/link",
    maxAge: 0,
  };
  response.cookies.set("twitch_link_state", "", options);
  if (clearPending) {
    response.cookies.set("discord_twitch_pending", "", options);
  }
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const cookieState = request.cookies.get("twitch_link_state")?.value;
  if (!matchesDiscordOAuthState(state, cookieState)) {
    return clearOAuthCookies(
      resultPage("Požadavek vypršel nebo není platný. Začni ověření znovu.", 400),
    );
  }

  const code = params.get("code");
  if (params.has("error") || !code) {
    return clearOAuthCookies(
      resultPage("Twitch autorizace nebyla dokončena. Vrať se na web a ověř Discord znovu.", 400),
      true,
    );
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const redirectUri = process.env.TWITCH_LINK_REDIRECT_URI;
  const discordClientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
  const discordId = discordClientSecret
    ? readPendingDiscordLink(
        request.cookies.get("discord_twitch_pending")?.value,
        discordClientSecret,
      )
    : null;
  if (!clientId || !clientSecret || !redirectUri || !discordId) {
    console.error("Missing Twitch link OAuth configuration or Discord verification.");
    return clearOAuthCookies(
      resultPage("Propojení Twitch není nakonfigurované nebo ověření Discordu vypršelo.", 400),
      true,
    );
  }

  const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
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
    console.error("Twitch OAuth token exchange failed:", tokenResponse.status);
    return clearOAuthCookies(
      resultPage("Twitch autorizaci se nepodařilo ověřit. Zkus propojení znovu.", 502),
      true,
    );
  }

  const userResponse = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${tokenBody.access_token}`,
    },
  });
  const userBody: unknown = await userResponse.json();
  if (!userResponse.ok || !isRecord(userBody) || !Array.isArray(userBody.data)) {
    console.error("Twitch profile lookup failed:", userResponse.status);
    return clearOAuthCookies(
      resultPage("Twitch účet se nepodařilo ověřit. Zkus propojení znovu.", 502),
      true,
    );
  }
  const twitchUser = userBody.data.find(isTwitchUser);
  if (!twitchUser) {
    return clearOAuthCookies(
      resultPage("Twitch nevrátil platnou identitu účtu.", 502),
      true,
    );
  }
  const twitchName = twitchUser.display_name?.trim() || twitchUser.login;

  const linkedElsewhere = await prisma.discordTwitchConnection.findUnique({
    where: { twitch_id: twitchUser.id },
    select: { discord_id: true },
  });
  if (linkedElsewhere && linkedElsewhere.discord_id !== discordId) {
    return clearOAuthCookies(
      resultPage("Tento Twitch účet už je propojený s jiným Discord účtem.", 409),
      true,
    );
  }

  try {
    await prisma.discordTwitchConnection.upsert({
      where: { discord_id: discordId },
      create: {
        discord_id: discordId,
        twitch_id: twitchUser.id,
        twitch_name: twitchName,
        verification_method: "twitch_oauth",
      },
      update: {
        twitch_id: twitchUser.id,
        twitch_name: twitchName,
        verification_method: "twitch_oauth",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return clearOAuthCookies(
        resultPage("Tento Twitch účet už je propojený s jiným Discord účtem.", 409),
        true,
      );
    }
    throw error;
  }

  const discordEntity = await prisma.discordEntity.findUnique({
    where: { discord_id: discordId },
    select: { name: true },
  });
  const nicknameErrors = await syncDiscordNickname(
    discordId,
    discordEntity?.name || discordId,
    twitchName,
  );
  const nicknameMessage = nicknameErrors.length
    ? " Twitch účet je propojený, ale přezdívku se nepodařilo aktualizovat. Zkontroluj oprávnění bota a jeho konfiguraci."
    : " Přezdívka na Discordu byla aktualizována.";
  return clearOAuthCookies(
    resultPage(`Twitch účet byl ověřen a propojen s tvým Discordem.${nicknameMessage}`),
    true,
  );
}
