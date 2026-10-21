import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

type FactInput = {
  title: string;
  body: string;
  category: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFacts(input: unknown): FactInput[] | string {
  if (!Array.isArray(input)) return "JSON musí být pole záznamů.";
  if (input.length > 200) return "Lze uložit nejvýše 200 zajímavostí.";

  const facts: FactInput[] = [];
  for (const [index, entry] of input.entries()) {
    if (!isRecord(entry)) {
      return `Záznam ${index + 1} musí být objekt.`;
    }
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const body = typeof entry.body === "string" ? entry.body.trim() : "";
    const categoryValue = entry.category;
    const category =
      categoryValue == null || categoryValue === ""
        ? null
        : typeof categoryValue === "string"
          ? categoryValue.trim() || null
          : undefined;

    if (!title || title.length > 120) {
      return `Záznam ${index + 1}: titulek je povinný a smí mít nejvýše 120 znaků.`;
    }
    if (!body || body.length > 5_000) {
      return `Záznam ${index + 1}: vysvětlení je povinné a smí mít nejvýše 5000 znaků.`;
    }
    if (category === undefined || (category !== null && category.length > 80)) {
      return `Záznam ${index + 1}: kategorie musí mít nejvýše 80 znaků.`;
    }
    facts.push({ title, body, category });
  }

  return facts;
}

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Přihlas se." }, { status: 401 });
  }
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Přístup odepřen." }, { status: 403 });
  }

  const facts = await prisma.interestingFact.findMany({
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { title: true, body: true, category: true },
  });
  return NextResponse.json(facts, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 403 });
  }
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Přihlas se." }, { status: 401 });
  }
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Přístup odepřen." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Požadavek neobsahuje platný JSON." }, { status: 400 });
  }
  if (!isRecord(payload) || !("facts" in payload)) {
    return NextResponse.json({ error: "Chybí pole zajímavostí." }, { status: 400 });
  }

  const facts = parseFacts(payload.facts);
  if (typeof facts === "string") {
    return NextResponse.json({ error: facts }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.interestingFact.deleteMany(),
    ...(facts.length > 0
      ? [
          prisma.interestingFact.createMany({
            data: facts,
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ saved: facts.length });
}
