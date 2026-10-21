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

function parseFact(entry: unknown, label: string): FactInput | string {
  if (!isRecord(entry)) return `${label} must be an object.`;
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
    return `${label}: title is required and must be no longer than 120 characters.`;
  }
  if (!body || body.length > 5_000) {
    return `${label}: body is required and must be no longer than 5,000 characters.`;
  }
  if (category === undefined || (category !== null && category.length > 80)) {
    return `${label}: category must be no longer than 80 characters.`;
  }
  return { title, body, category };
}

function parseFacts(input: unknown): FactInput[] | string {
  if (!Array.isArray(input)) return "JSON must be an array of items.";
  if (input.length > 200) return "You can save up to 200 fun facts.";

  const facts: FactInput[] = [];
  for (const [index, entry] of input.entries()) {
    const fact = parseFact(entry, `Item ${index + 1}`);
    if (typeof fact === "string") return fact;
    facts.push(fact);
  }
  return facts;
}

async function requireAdmin(request?: Request) {
  if (request && !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const authorizationError = await requireAdmin();
  if (authorizationError) return authorizationError;

  const facts = await prisma.interestingFact.findMany({
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { id: true, title: true, body: true, category: true },
  });
  return NextResponse.json(facts, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  const authorizationError = await requireAdmin(request);
  if (authorizationError) return authorizationError;

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

export async function POST(request: Request) {
  const authorizationError = await requireAdmin(request);
  if (authorizationError) return authorizationError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 });
  }

  const fact = parseFact(payload, "Fun fact");
  if (typeof fact === "string") {
    return NextResponse.json({ error: fact }, { status: 400 });
  }
  const count = await prisma.interestingFact.count();
  if (count >= 200) {
    return NextResponse.json(
      { error: "You can save up to 200 fun facts." },
      { status: 400 },
    );
  }

  const created = await prisma.interestingFact.create({
    data: fact,
    select: { id: true, title: true, body: true, category: true },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorizationError = await requireAdmin(request);
  if (authorizationError) return authorizationError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 });
  }
  if (!isRecord(payload) || typeof payload.id !== "string" || !payload.id) {
    return NextResponse.json({ error: "A fun fact ID is required." }, { status: 400 });
  }

  const fact = parseFact(payload, "Fun fact");
  if (typeof fact === "string") {
    return NextResponse.json({ error: fact }, { status: 400 });
  }

  const updated = await prisma.interestingFact.updateMany({
    where: { id: payload.id },
    data: fact,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Fun fact not found." }, { status: 404 });
  }
  return NextResponse.json({ id: payload.id, ...fact });
}

export async function DELETE(request: Request) {
  const authorizationError = await requireAdmin(request);
  if (authorizationError) return authorizationError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must contain valid JSON." }, { status: 400 });
  }
  if (!isRecord(payload) || typeof payload.id !== "string" || !payload.id) {
    return NextResponse.json({ error: "A fun fact ID is required." }, { status: 400 });
  }

  const deleted = await prisma.interestingFact.deleteMany({
    where: { id: payload.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Fun fact not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
