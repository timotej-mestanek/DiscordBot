"use client";

import { useEffect, useState } from "react";

const exampleJson = JSON.stringify(
  [
    {
      title: "Why is the sky blue?",
      body: "Air molecules scatter blue light more than red light.",
      category: "Science",
    },
  ],
  null,
  2,
);

export default function InterestingFactsPanel() {
  const [json, setJson] = useState(exampleJson);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/interesting")
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Could not load fun facts.";
          throw new Error(message);
        }
        if (!active) return;
        setJson(JSON.stringify(result, null, 2));
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Interesting facts admin load failed:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load fun facts.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setError("");
    setNotice("");
    let facts: unknown;
    try {
      facts = JSON.parse(json);
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? `Invalid JSON: ${parseError.message}`
          : "The text is not valid JSON.",
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/interesting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not save fun facts.";
        setError(message);
        return;
      }
      const savedCount =
        typeof result === "object" &&
        result !== null &&
        "saved" in result &&
        typeof result.saved === "number"
          ? result.saved
          : 0;
      setNotice(`Saved ${savedCount} fun facts.`);
    } catch (saveError) {
      console.error("Interesting facts admin save failed:", saveError);
      setError("Could not save fun facts. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-violet-800/50 bg-gradient-to-br from-violet-950/60 via-zinc-900 to-cyan-950/30 p-6 shadow-xl shadow-violet-950/20 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-300">
              Daily content · public API
            </p>
            <h2 className="mt-2 text-2xl font-bold">Fun fact of the day</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              One fun fact is shown each day. The selection changes at midnight
              in the fixed GMT+2 time zone and remains the same throughout the day.
            </p>
          </div>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
            GMT+2 · 1 fact per day
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">JSON database</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Saving replaces the entire list. Category is optional.
            </p>
          </div>
          <span className="text-xs text-zinc-500">
            {loading ? "Loading…" : "Format: array of objects"}
          </span>
        </div>
        <textarea
          value={json}
          onChange={(event) => {
            setJson(event.target.value);
            setNotice("");
          }}
          spellCheck={false}
          aria-label="JSON fun facts list"
          className="mt-4 min-h-80 w-full resize-y rounded-xl border border-zinc-700 bg-[#09090f] p-4 font-mono text-sm leading-6 text-violet-100 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Validate JSON and save"}
          </button>
          {notice && (
            <p role="status" className="text-sm text-emerald-300">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Each item must have <code className="text-violet-300">title</code> and{" "}
          <code className="text-violet-300">body</code>. You can also add an
          optional <code className="text-violet-300">category</code>.
          The limit is 200 items.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Public API</h2>
        <p className="mt-1 text-sm text-zinc-400">
          This endpoint is public and supports CORS. Every format returns the
          same single daily fact.
        </p>
        <div className="mt-4 grid gap-3">
          {[
            {
              format: "json",
              description: "Plain JSON for loading data on another page.",
            },
            {
              format: "animated",
              description: "Animated HTML card for embedding in an iframe.",
            },
            {
              format: "static",
              description: "Static HTML card for embedding in an iframe.",
            },
          ].map(({ format, description }) => (
            <article
              key={format}
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
            >
              <code className="break-all text-sm text-cyan-200">
                /api/interesting?format={format}
              </code>
              <p className="mt-1 text-xs text-zinc-400">{description}</p>
            </article>
          ))}
        </div>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-800 bg-black/30 p-4 text-xs leading-5 text-zinc-300">
{`<iframe
  src="https://your-domain.example/api/interesting?format=animated"
  style="width:100%;height:360px;border:0"
></iframe>`}
        </pre>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          JSON response: <code>{`{"title":"…","body":"…","category":"…"}`}</code>.
          The API returns HTTP 404 if there are no facts to display.
        </p>
      </section>
    </div>
  );
}
