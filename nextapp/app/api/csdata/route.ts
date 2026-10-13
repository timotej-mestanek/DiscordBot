import { store } from "@/lib/store"
import type { GSIData } from "@/types/gsi"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const data = (await request.json()) as GSIData

  store.latest = data
  store.updatedAt = Date.now()

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json(
    {
      updatedAt: store.updatedAt,
      data: store.latest,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}