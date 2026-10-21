"use client";

import { useEffect, useState } from "react";

type InterestingFact = {
  id: string;
  title: string;
  body: string;
  category: string | null;
};

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
  const [facts, setFacts] = useState<InterestingFact[]>([]);
  const [json, setJson] = useState(exampleJson);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFactId, setSavingFactId] = useState<string | null>(null);
  const [deletingFactId, setDeletingFactId] = useState<string | null>(null);
  const mutationsBusy =
    saving || savingFactId !== null || deletingFactId !== null;

  function syncFacts(nextFacts: InterestingFact[]) {
    setFacts(nextFacts);
    setJson(
      JSON.stringify(
        nextFacts.map(({ title, body, category }) => ({ title, body, category })),
        null,
        2,
      ),
    );
  }

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
        if (!Array.isArray(result)) throw new Error("Unexpected fun facts response.");
        syncFacts(result as InterestingFact[]);
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

  function updateFact(id: string, update: Partial<Omit<InterestingFact, "id">>) {
    setFacts((current) =>
      current.map((fact) => (fact.id === id ? { ...fact, ...update } : fact)),
    );
    setNotice("");
  }

  async function saveFact(fact: InterestingFact) {
    setError("");
    setNotice("");
    setSavingFactId(fact.id);
    try {
      const response = await fetch("/api/admin/interesting", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fact),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not update this fun fact.";
        setError(message);
        return;
      }
      const updatedFact = result as InterestingFact;
      const nextFacts = facts.map((item) =>
        item.id === updatedFact.id ? updatedFact : item,
      );
      syncFacts(nextFacts);
      setNotice("Fun fact updated.");
    } catch (saveError) {
      console.error("Interesting fact update failed:", saveError);
      setError("Could not update this fun fact. Check your connection and try again.");
    } finally {
      setSavingFactId(null);
    }
  }

  async function deleteFact(fact: InterestingFact) {
    if (!window.confirm(`Delete "${fact.title}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    setDeletingFactId(fact.id);
    try {
      const response = await fetch("/api/admin/interesting", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fact.id }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not delete this fun fact.";
        setError(message);
        return;
      }
      const nextFacts = facts.filter((item) => item.id !== fact.id);
      syncFacts(nextFacts);
      setNotice("Fun fact deleted.");
    } catch (deleteError) {
      console.error("Interesting fact deletion failed:", deleteError);
      setError("Could not delete this fun fact. Check your connection and try again.");
    } finally {
      setDeletingFactId(null);
    }
  }

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
      const refreshResponse = await fetch("/api/admin/interesting", {
        cache: "no-store",
      });
      if (!refreshResponse.ok) {
        throw new Error("Saved the JSON list, but could not refresh its item IDs.");
      }
      const refreshedFacts: unknown = await refreshResponse.json();
      if (!Array.isArray(refreshedFacts)) {
        throw new Error("Saved the JSON list, but received an invalid refresh response.");
      }
      syncFacts(refreshedFacts as InterestingFact[]);
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Saved fun facts</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Edit individual facts or remove ones you no longer want to publish.
            </p>
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
            {facts.length} / 200 facts
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading saved fun facts…</p>
        ) : facts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">
            There are no saved facts. Import some with the JSON editor below.
          </p>
        ) : (
          <div className="space-y-3">
            {facts.map((fact, index) => (
              <article
                key={fact.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-violet-200">
                    Fact {index + 1}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveFact(fact)}
                      disabled={mutationsBusy}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingFactId === fact.id ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteFact(fact)}
                      disabled={mutationsBusy}
                      className="rounded-lg border border-red-900/70 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingFactId === fact.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <label className="text-xs text-zinc-400">
                    Title
                    <input
                      value={fact.title}
                      maxLength={120}
                      disabled={mutationsBusy}
                      onChange={(event) =>
                        updateFact(fact.id, { title: event.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Explanation
                    <textarea
                      value={fact.body}
                      maxLength={5_000}
                      rows={3}
                      disabled={mutationsBusy}
                      onChange={(event) =>
                        updateFact(fact.id, { body: event.target.value })
                      }
                      className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-6 text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Category (optional)
                    <input
                      value={fact.category ?? ""}
                      maxLength={80}
                      disabled={mutationsBusy}
                      onChange={(event) =>
                        updateFact(fact.id, { category: event.target.value || null })
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-emerald-300">
            {notice}
          </p>
        )}
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
          disabled={mutationsBusy}
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
            disabled={mutationsBusy || loading}
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
