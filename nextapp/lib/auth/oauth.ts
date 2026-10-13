import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  getAccountForToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  createDiscordOAuthState,
  matchesDiscordOAuthState,
} from "@/lib/oauth/discordState";
import { syncDiscordNickname } from "@/lib/discord/syncNickname";

export type OAuthProvider = "discord" | "twitch";

type ProviderProfile = {
  id: string;
  name: string;
  login?: string;
};

const providerConfig = {
  discord: {
    clientId: "DISCORD_OAUTH_CLIENT_ID",
    clientSecret: "DISCORD_OAUTH_CLIENT_SECRET",
    redirectUri: "DISCORD_LOGIN_REDIRECT_URI",
    authorizationUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scopes: "identify",
  },
  twitch: {
    clientId: "TWITCH_CLIENT_ID",
    clientSecret: "TWITCH_CLIENT_SECRET",
    redirectUri: "TWITCH_LOGIN_REDIRECT_URI",
    authorizationUrl: "https://id.twitch.tv/oauth2/authorize",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    scopes: "",
  },
} satisfies Record<
  OAuthProvider,
  {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string;
  }
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProviderSetting(provider: OAuthProvider, key: "clientId" | "clientSecret" | "redirectUri") {
  const envName = providerConfig[provider][key];
  const value = process.env[envName]?.trim();
  if (!value) throw new Error(`Missing OAuth configuration: ${envName}.`);
  return value;
}

export function startOAuth(provider: OAuthProvider): NextResponse {
  const config = providerConfig[provider];
  const clientId = getProviderSetting(provider, "clientId");
  const redirectUri = getProviderSetting(provider, "redirectUri");
  const state = createDiscordOAuthState();
  const authorizeUrl = new URL(config.authorizationUrl);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  if (config.scopes) authorizeUrl.searchParams.set("scope", config.scopes);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/login/${provider}/callback`,
    maxAge: 600,
  });
  return response;
}

async function fetchProfile(
  provider: OAuthProvider,
  code: string,
): Promise<ProviderProfile> {
  const config = providerConfig[provider];
  const clientId = getProviderSetting(provider, "clientId");
  const clientSecret = getProviderSetting(provider, "clientSecret");
  const redirectUri = getProviderSetting(provider, "redirectUri");
  const tokenResponse = await fetch(config.tokenUrl, {
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
    console.error(`${provider} login token exchange failed:`, tokenResponse.status);
    throw new Error("OAuth token exchange failed.");
  }

  const profileResponse = provider === "discord"
    ? await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` },
      })
    : await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${tokenBody.access_token}`,
        },
      });
  const profileBody: unknown = await profileResponse.json();
  if (!profileResponse.ok) {
    console.error(`${provider} profile lookup failed:`, profileResponse.status);
    throw new Error("OAuth profile lookup failed.");
  }

  if (provider === "discord") {
    if (
      !isRecord(profileBody) ||
      typeof profileBody.id !== "string" ||
      typeof profileBody.username !== "string"
    ) {
      throw new Error("Discord returned an invalid profile.");
    }
    return {
      id: profileBody.id,
      name:
        typeof profileBody.global_name === "string" &&
        profileBody.global_name.trim()
          ? profileBody.global_name.trim()
          : profileBody.username,
    };
  }

  if (!isRecord(profileBody) || !Array.isArray(profileBody.data)) {
    throw new Error("Twitch returned an invalid profile.");
  }
  const twitchProfile: unknown = profileBody.data[0];
  if (
    !isRecord(twitchProfile) ||
    typeof twitchProfile.id !== "string" ||
    typeof twitchProfile.login !== "string"
  ) {
    throw new Error("Twitch returned an invalid profile.");
  }
  return {
    id: twitchProfile.id,
    name:
      typeof twitchProfile.display_name === "string" &&
      twitchProfile.display_name.trim()
        ? twitchProfile.display_name.trim()
        : twitchProfile.login,
    login: twitchProfile.login.toLowerCase(),
  };
}

async function syncLinkedDiscordTwitch(accountId: string): Promise<void> {
  const identities = await prisma.oAuthIdentity.findMany({
    where: { account_id: accountId },
    select: {
      provider: true,
      provider_user_id: true,
      display_name: true,
    },
  });
  const discord = identities.find((item) => item.provider === "discord");
  const twitch = identities.find((item) => item.provider === "twitch");
  if (!discord || !twitch) return;

  const otherDiscord = await prisma.discordTwitchConnection.findUnique({
    where: { twitch_id: twitch.provider_user_id },
    select: { discord_id: true },
  });
  if (otherDiscord && otherDiscord.discord_id !== discord.provider_user_id) {
    console.error(
      `Twitch account ${twitch.provider_user_id} is already linked to another Discord account.`,
    );
    return;
  }

  try {
    await prisma.discordTwitchConnection.upsert({
      where: { discord_id: discord.provider_user_id },
      create: {
        discord_id: discord.provider_user_id,
        twitch_id: twitch.provider_user_id,
        twitch_name: twitch.display_name,
        verification_method: "web_account",
      },
      update: {
        twitch_id: twitch.provider_user_id,
        twitch_name: twitch.display_name,
        verification_method: "web_account",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.error("Linked web accounts conflict with an existing Discord-Twitch link.");
      return;
    }
    throw error;
  }

  const nicknameErrors = await syncDiscordNickname(
    discord.provider_user_id,
    discord.display_name,
    twitch.display_name,
  );
  if (nicknameErrors.length > 0) {
    console.error("Discord-Twitch account link saved, but nickname sync had errors.");
  }
}

async function grantConfiguredInitialAdmin(
  provider: OAuthProvider,
  profile: ProviderProfile,
  accountId: string,
): Promise<void> {
  const initialAdminTwitchId = process.env.INITIAL_ADMIN_TWITCH_ID?.trim();
  const initialAdminTwitchLogin =
    process.env.INITIAL_ADMIN_TWITCH_LOGIN?.trim().toLowerCase();
  if (
    provider !== "twitch" ||
    !(
      (initialAdminTwitchId && profile.id === initialAdminTwitchId) ||
      (initialAdminTwitchLogin && profile.login === initialAdminTwitchLogin)
    )
  ) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const promoted = await transaction.webAccount.updateMany({
      where: { id: accountId, role: "user" },
      data: { role: "admin" },
    });
    if (promoted.count > 0) {
      await transaction.adminAuditLog.create({
        data: {
          actor_account_id: accountId,
          target_account_id: accountId,
          action: "admin.initial_grant",
          details: { provider, providerUserId: profile.id },
        },
      });
    }
  });
}

async function mergeLinkedAccounts(
  currentAccountId: string,
  identityAccountId: string,
  provider: OAuthProvider,
  providerUserId: string,
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const [current, identityOwner] = await Promise.all([
      transaction.webAccount.findUnique({
        where: { id: currentAccountId },
        select: { id: true, role: true, identities: { select: { provider: true } } },
      }),
      transaction.webAccount.findUnique({
        where: { id: identityAccountId },
        select: { id: true, role: true, identities: { select: { provider: true } } },
      }),
    ]);
    if (!current || !identityOwner) return false;

    const currentProviders = new Set(current.identities.map((item) => item.provider));
    const duplicateProvider = identityOwner.identities.some((item) =>
      currentProviders.has(item.provider),
    );
    if (duplicateProvider) return false;

    await transaction.oAuthIdentity.updateMany({
      where: { account_id: identityOwner.id },
      data: { account_id: current.id },
    });
    await transaction.webSession.updateMany({
      where: { account_id: identityOwner.id },
      data: { account_id: current.id },
    });
    await transaction.adminAuditLog.updateMany({
      where: { actor_account_id: identityOwner.id },
      data: { actor_account_id: current.id },
    });
    await transaction.adminAuditLog.updateMany({
      where: { target_account_id: identityOwner.id },
      data: { target_account_id: current.id },
    });
    await transaction.pointLedgerEntry.updateMany({
      where: { actor_account_id: identityOwner.id },
      data: { actor_account_id: current.id },
    });
    await transaction.webAccount.update({
      where: { id: current.id },
      data: {
        role:
          current.role === "admin" || identityOwner.role === "admin"
            ? "admin"
            : "user",
      },
    });
    await transaction.adminAuditLog.create({
      data: {
        actor_account_id: current.id,
        target_account_id: current.id,
        action: "account.merged",
        details: {
          retainedAccountId: current.id,
          mergedAccountId: identityOwner.id,
          verifiedProvider: provider,
          verifiedProviderUserId: providerUserId,
        },
      },
    });
    await transaction.webAccount.delete({ where: { id: identityOwner.id } });
    return true;
  });
}

export async function completeOAuth(
  request: NextRequest,
  provider: OAuthProvider,
): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const cookieName = `oauth_state_${provider}`;
  const cookieState = request.cookies.get(cookieName)?.value;
  if (!matchesDiscordOAuthState(state, cookieState)) {
    return finishResponse(
      await callbackErrorRedirect(request, "state"),
      provider,
    );
  }

  const code = params.get("code");
  if (params.has("error") || !code) {
    return finishResponse(
      await callbackErrorRedirect(request, "denied"),
      provider,
    );
  }

  let profile: ProviderProfile;
  try {
    profile = await fetchProfile(provider, code);
  } catch (error) {
    console.error(`Failed to complete ${provider} OAuth login:`, error);
    return finishResponse(
      await callbackErrorRedirect(request, "provider"),
      provider,
    );
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const activeAccount = sessionToken
    ? await getAccountForToken(sessionToken)
    : null;
  const identity = await prisma.oAuthIdentity.findUnique({
    where: {
      provider_provider_user_id: {
        provider,
        provider_user_id: profile.id,
      },
    },
  });

  if (activeAccount) {
    if (identity && identity.account_id !== activeAccount.id) {
      let merged: boolean;
      try {
        merged = await mergeLinkedAccounts(
          activeAccount.id,
          identity.account_id,
          provider,
          profile.id,
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          merged = false;
        } else {
          throw error;
        }
      }
      if (!merged) {
        return finishResponse(
          NextResponse.redirect(
            new URL("/dashboard?error=identity-in-use", request.url),
          ),
          provider,
        );
      }
      await prisma.oAuthIdentity.update({
        where: {
          provider_provider_user_id: {
            provider,
            provider_user_id: profile.id,
          },
        },
        data: { display_name: profile.name },
      });
      await grantConfiguredInitialAdmin(provider, profile, activeAccount.id);
      await syncLinkedDiscordTwitch(activeAccount.id);
      return finishResponse(
        NextResponse.redirect(
          new URL(`/dashboard?linked=${provider}&merged=true`, request.url),
        ),
        provider,
      );
    }
    if (!identity) {
      try {
        await prisma.oAuthIdentity.create({
          data: {
            provider,
            provider_user_id: profile.id,
            display_name: profile.name,
            account_id: activeAccount.id,
          },
        });
        await prisma.webAccount.update({
          where: { id: activeAccount.id },
          data: {
            display_name: activeAccount.display_name || profile.name,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return finishResponse(
            NextResponse.redirect(
              new URL("/dashboard?error=identity-in-use", request.url),
            ),
            provider,
          );
        }
        throw error;
      }
    } else {
      await prisma.oAuthIdentity.update({
        where: { id: identity.id },
        data: { display_name: profile.name },
      });
    }
    await grantConfiguredInitialAdmin(provider, profile, activeAccount.id);
    await syncLinkedDiscordTwitch(activeAccount.id);
    return finishResponse(
      NextResponse.redirect(
        new URL(`/dashboard?linked=${provider}`, request.url),
      ),
      provider,
    );
  }

  let accountId = identity?.account_id;
  if (!accountId) {
    try {
      const account = await prisma.webAccount.create({
        data: {
          display_name: profile.name,
          identities: {
            create: {
              provider,
              provider_user_id: profile.id,
              display_name: profile.name,
            },
          },
        },
      });
      accountId = account.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const racedIdentity = await prisma.oAuthIdentity.findUnique({
          where: {
            provider_provider_user_id: {
              provider,
              provider_user_id: profile.id,
            },
          },
          select: { account_id: true, id: true },
        });
        if (!racedIdentity) throw error;
        accountId = racedIdentity.account_id;
        await prisma.oAuthIdentity.update({
          where: { id: racedIdentity.id },
          data: { display_name: profile.name },
        });
      } else {
        throw error;
      }
    }
  }

  if (identity) {
    await prisma.oAuthIdentity.update({
      where: { id: identity.id },
      data: { display_name: profile.name },
    });
  }
  await grantConfiguredInitialAdmin(provider, profile, accountId);
  await syncLinkedDiscordTwitch(accountId);
  const token = await createSession(accountId);
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return finishResponse(response, provider);
}

async function callbackErrorRedirect(
  request: NextRequest,
  error: "state" | "denied" | "provider",
): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const account = token ? await getAccountForToken(token) : null;
  const destination = account
    ? `/dashboard?error=${error}`
    : `/login?error=${error}`;
  return NextResponse.redirect(new URL(destination, request.url));
}

function finishResponse(
  response: NextResponse,
  provider: OAuthProvider,
): NextResponse {
  response.cookies.set(`oauth_state_${provider}`, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/api/login/${provider}/callback`,
    maxAge: 0,
  });
  return response;
}
