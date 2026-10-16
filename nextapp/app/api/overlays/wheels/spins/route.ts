import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

type SpinCursor = { createdAt: string; id: string };

function encodeCursor(cursor: SpinCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): SpinCursor | null {
  if (value.length > 500 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("createdAt" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      !("id" in parsed) ||
      typeof parsed.id !== "string" ||
      parsed.id.length > 100
    ) {
      return null;
    }
    const date = new Date(parsed.createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return { createdAt: date.toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const encodedCursor = new URL(request.url).searchParams.get("cursor");
  if (encodedCursor && !decodeCursor(encodedCursor)) {
    return NextResponse.json({ error: "Neplatný kurzor." }, { status: 400 });
  }
  const cursor = encodedCursor ? decodeCursor(encodedCursor) : null;
  const initialCursor = cursor ?? {
    createdAt: new Date().toISOString(),
    id: "",
  };
  const cursorDate = new Date(initialCursor.createdAt);

  try {
    const page = await prisma.wheelSpin.findMany({
      where: {
        OR: [
          { created_at: { gt: cursorDate } },
          { created_at: cursorDate, id: { gt: initialCursor.id } },
        ],
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        event_id: true,
        display_name: true,
        sequence: true,
        created_at: true,
      },
    });
    const hasMore = page.length > PAGE_SIZE;
    const spins = hasMore ? page.slice(0, PAGE_SIZE) : page;
    const lastSpin = spins[spins.length - 1];
    return NextResponse.json(
      {
        spins,
        cursor: lastSpin
          ? encodeCursor({ createdAt: lastSpin.created_at.toISOString(), id: lastSpin.id })
          : encodeCursor(initialCursor),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Wheel overlay spin queue lookup failed:", error);
    return NextResponse.json(
      { error: "Koleso sa nepodarilo načítať." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
