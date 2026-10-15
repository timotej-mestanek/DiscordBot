import { NextRequest, NextResponse } from "next/server";
import {
  deleteSession,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import { getAppUrl } from "@/lib/app-url";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const response = NextResponse.redirect(
    new URL("/login", getAppUrl(request.url)),
    303,
  );
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
