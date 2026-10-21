import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1_000;
const GMT_PLUS_TWO_MS = 2 * 60 * 60 * 1_000;
const publicHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

type InterestingFact = {
  title: string;
  body: string;
  category: string | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function renderHtml(fact: InterestingFact, animated: boolean): string {
  const title = escapeHtml(fact.title);
  const body = escapeHtml(fact.body);
  const category = fact.category
    ? `<span class="category">${escapeHtml(fact.category)}</span>`
    : "";
  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${title} · N4JT</title>
  <style>
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      display: grid; place-items: center; margin: 0; padding: 24px;
      overflow: hidden; color: #f5f3ff;
      background: radial-gradient(ellipse at 18% 8%, #33205f 0, transparent 48%),
                  radial-gradient(ellipse at 90% 95%, #153a52 0, transparent 44%), #09090f;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .card {
      position: relative; isolation: isolate; width: min(100%, 680px); overflow: hidden;
      padding: clamp(26px, 6vw, 54px); border: 1px solid #ffffff20; border-radius: 26px;
      background: linear-gradient(135deg, #ffffff12, #ffffff05);
      box-shadow: 0 28px 90px #0009, inset 0 1px #ffffff16;
      backdrop-filter: blur(18px);
      ${animated ? "animation: reveal .85s cubic-bezier(.2,.8,.2,1) both;" : ""}
    }
    .card::before {
      position: absolute; z-index: -1; top: -100px; right: -80px; width: 260px; height: 260px;
      border-radius: 50%; background: #a855f755; filter: blur(60px); content: "";
    }
    .eyebrow { display: flex; align-items: center; gap: 10px; color: #c4b5fd; font-size: 11px;
      font-weight: 800; letter-spacing: .24em; text-transform: uppercase; }
    .spark { color: #f0abfc; font-size: 18px; }
    .category { display: inline-flex; margin-top: 28px; padding: 6px 11px; border: 1px solid #a78bfa50;
      border-radius: 999px; background: #7c3aed20; color: #ddd6fe; font-size: 11px; font-weight: 700; }
    h1 { margin: 16px 0 0; font-size: clamp(28px, 6vw, 46px); line-height: 1.08;
      letter-spacing: -.04em; text-wrap: balance; }
    .body { margin: 18px 0 0; color: #c4c2d1; font-size: clamp(15px, 2.5vw, 18px);
      line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
    .rule { width: 58px; height: 3px; margin-top: 28px; border-radius: 9px;
      background: linear-gradient(90deg, #c084fc, #67e8f9); }
    @keyframes reveal { from { opacity: 0; transform: translateY(18px) scale(.985); }
      to { opacity: 1; transform: translateY(0) scale(1); } }
    @media (prefers-reduced-motion: reduce) { .card { animation: none !important; } }
  </style>
</head>
<body>
  <main class="card">
    <div class="eyebrow"><span class="spark">✦</span> N4JT · ZAJÍMAVOST DNE</div>
    ${category}
    <h1>${title}</h1>
    <p class="body">${body}</p>
    <div class="rule"></div>
  </main>
</body>
</html>`;
}

function responseHeaders(contentType: string) {
  return { ...publicHeaders, "Content-Type": contentType };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  if (!["json", "animated", "static"].includes(format)) {
    return NextResponse.json(
      { error: "Formát musí být json, animated nebo static." },
      { status: 400, headers: publicHeaders },
    );
  }

  const facts = await prisma.interestingFact.findMany({
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { title: true, body: true, category: true },
  });
  if (facts.length === 0) {
    return NextResponse.json(
      { error: "Zatím nejsou zveřejněné žádné zajímavosti." },
      { status: 404, headers: publicHeaders },
    );
  }

  const gmtPlusTwoDay = Math.floor((Date.now() + GMT_PLUS_TWO_MS) / DAY_MS);
  const fact = facts[gmtPlusTwoDay % facts.length];
  if (!fact) {
    return NextResponse.json(
      { error: "Zajímavost se nepodařilo vybrat." },
      { status: 500, headers: publicHeaders },
    );
  }

  if (format === "json") {
    return NextResponse.json(fact, { headers: publicHeaders });
  }
  return new Response(renderHtml(fact, format === "animated"), {
    headers: responseHeaders("text/html; charset=utf-8"),
  });
}
