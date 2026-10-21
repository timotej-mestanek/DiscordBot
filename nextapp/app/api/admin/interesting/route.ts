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
  if (!Array.isArray(input)) return "JSON must be an array of items.";
  if (input.length > 200) return "You can save up to 200 fun facts.";

  const facts: FactInput[] = [];
  for (const [index, entry] of input.entries()) {
    if (!isRecord(entry)) {
      return `Item ${index + 1} must be an object.`;
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
      return `Item ${index + 1}: title is required and must be no longer than 120 characters.`;
    }
    if (!body || body.length > 5_000) {
      return `Item ${index + 1}: body is required and must be no longer than 5,000 characters.`;
    }
    if (category === undefined || (category !== null && category.length > 80)) {
      return `Item ${index + 1}: category must be no longer than 80 characters.`;
    }
    facts.push({ title, body, category });
  }

  return facts;
}

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
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
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 });
  }
  if (!isRecord(payload) || !("facts" in payload)) {
    return NextResponse.json({ error: "The facts array is required." }, { status: 400 });
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
