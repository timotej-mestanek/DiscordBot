import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const admin = await getCurrentAccount();
  if (!admin) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && (cursor.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  }

  try {
    const page = await prisma.streamerBotIntegrationLog.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
    });
    const hasMore = page.length > PAGE_SIZE;
    const logs = hasMore ? page.slice(0, PAGE_SIZE) : page;
    return NextResponse.json({
      logs,
      nextCursor: hasMore ? logs[logs.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    console.error("Streamer.bot dashboard logs lookup failed:", error);
    return NextResponse.json(
      { error: "Could not load Streamer.bot logs." },
      { status: 500 },
    );
  }
}
