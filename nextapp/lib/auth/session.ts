import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "app_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentAccount() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return getAccountForToken(token);
}

export async function getAccountForToken(token: string) {
  const session = await prisma.webSession.findUnique({
    where: { token_hash: hashToken(token) },
    include: {
      account: {
        include: {
          identities: {
            select: {
              provider: true,
              provider_user_id: true,
              display_name: true,
            },
          },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expires_at <= new Date()) {
    await prisma.webSession.delete({ where: { id: session.id } });
    return null;
  }

  return {
    sessionId: session.id,
    ...session.account,
  };
}

export async function createSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.webSession.create({
    data: {
      token_hash: hashToken(token),
      account_id: accountId,
      expires_at: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000),
    },
  });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.webSession.deleteMany({
    where: { token_hash: hashToken(token) },
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  };
}
