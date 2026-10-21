"use client";

import { useEffect, useMemo, useState } from "react";

type InterestingFact = {
  id: string;
  title: string;
  body: string;
  category: string | null;
};

type FactEditor = {
  id: string | null;
  title: string;
  body: string;
  category: string;
};

const emptyEditor: FactEditor = { id: null, title: "", body: "", category: "" };

function toEditor(fact: InterestingFact): FactEditor {
  return { ...fact, category: fact.category ?? "" };
}

function errorMessage(result: unknown, fallback: string): string {
  return typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
    ? result.error
    : fallback;
}

export default function InterestingFactsPanel() {
  const [facts, setFacts] = useState<InterestingFact[]>([]);
  const [editor, setEditor] = useState<FactEditor>(emptyEditor);
  const [json, setJson] = useState("[]");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mutationsBusy = saving || deleting;

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
          throw new Error(errorMessage(result, "Could not load fun facts."));
        }
        if (!Array.isArray(result)) throw new Error("Unexpected fun facts response.");
        if (active) syncFacts(result as InterestingFact[]);
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

  const filteredFacts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return facts;
    return facts.filter(
      (fact) =>
        fact.title.toLocaleLowerCase().includes(query) ||
        fact.category?.toLocaleLowerCase().includes(query),
    );
  }, [facts, search]);

  const selectedFact = facts.find((fact) => fact.id === editor.id) ?? null;
  const isDirty = editor.id === null
    ? Boolean(editor.title || editor.body || editor.category)
    : Boolean(
        selectedFact &&
          (editor.title !== selectedFact.title ||
            editor.body !== selectedFact.body ||
            editor.category !== (selectedFact.category ?? "")),
      );

  function canLeaveEditor(): boolean {
    return !isDirty || window.confirm("Discard unsaved changes?");
  }

  function selectFact(fact: InterestingFact) {
    if (fact.id === editor.id || !canLeaveEditor()) return;
    setEditor(toEditor(fact));
    setError("");
    setNotice("");
  }

  function addFact() {
    if (!canLeaveEditor()) return;
    setEditor({ ...emptyEditor });
    setError("");
    setNotice("");
  }

  async function saveFact() {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const isNew = editor.id === null;
      const response = await fetch("/api/admin/interesting", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isNew ? {} : { id: editor.id }),
          title: editor.title,
          body: editor.body,
          category: editor.category || null,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(errorMessage(result, "Could not save this fun fact."));
        return;
      }

      const savedFact = result as InterestingFact;
      const nextFacts = isNew
        ? [...facts, savedFact]
        : facts.map((fact) => (fact.id === savedFact.id ? savedFact : fact));
      syncFacts(nextFacts);
      setEditor(toEditor(savedFact));
      setNotice(isNew ? "Fun fact added." : "Fun fact updated.");
    } catch (saveError) {
      console.error("Interesting fact save failed:", saveError);
      setError("Could not save this fun fact. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFact() {
    if (!editor.id) return;
    if (!window.confirm(`Delete "${editor.title}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    setDeleting(true);
    try {
      const response = await fetch("/api/admin/interesting", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editor.id }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(errorMessage(result, "Could not delete this fun fact."));
        return;
      }
      syncFacts(facts.filter((fact) => fact.id !== editor.id));
      setEditor({ ...emptyEditor });
      setNotice("Fun fact deleted.");
    } catch (deleteError) {
      console.error("Interesting fact deletion failed:", deleteError);
      setError("Could not delete this fun fact. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function importJson() {
    setError("");
    setNotice("");
    let parsedFacts: unknown;
    try {
      parsedFacts = JSON.parse(json);
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? `Invalid JSON: ${parseError.message}`
          : "The text is not valid JSON.",
      );
      return;
    }
    if (!Array.isArray(parsedFacts)) {
      setError("JSON must be an array of fun facts.");
      return;
    }
    if (!canLeaveEditor()) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/interesting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts: parsedFacts }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(errorMessage(result, "Could not import fun facts."));
        return;
      }
      const refreshResponse = await fetch("/api/admin/interesting", {
        cache: "no-store",
      });
      const refreshedFacts: unknown = await refreshResponse.json();
      if (!refreshResponse.ok || !Array.isArray(refreshedFacts)) {
        throw new Error("Imported the JSON list, but could not refresh saved facts.");
      }
      syncFacts(refreshedFacts as InterestingFact[]);
      setEditor({ ...emptyEditor });
      setNotice(`Imported ${refreshedFacts.length} fun facts.`);
    } catch (importError) {
      console.error("Interesting facts JSON import failed:", importError);
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import fun facts. Check your connection and try again.",
      );
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
            <h2 className="text-lg font-semibold">Fun facts database</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Select a title to edit it, or add a new fact.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{facts.length} / 200</span>
            <button
              type="button"
              onClick={addFact}
              disabled={mutationsBusy || facts.length >= 200}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">
            {notice}
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
          <aside className="min-w-0">
            <label className="block text-xs text-zinc-400">
              Search titles and categories
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search…"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
              {loading ? (
                <p className="p-3 text-sm text-zinc-500">Loading fun facts…</p>
              ) : filteredFacts.length === 0 ? (
                <p className="p-3 text-sm text-zinc-500">
                  {facts.length === 0 ? "No saved facts yet." : "No matching facts."}
                </p>
              ) : (
                filteredFacts.map((fact) => (
                  <button
                    key={fact.id}
                    type="button"
                    onClick={() => selectFact(fact)}
                    aria-pressed={editor.id === fact.id}
                    className={`block w-full rounded-lg border px-3 py-2.5 text-left transition ${
                      editor.id === fact.id
                        ? "border-violet-500/70 bg-violet-500/15 text-white"
                        : "border-transparent text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">
                      {fact.title}
                    </span>
                    {fact.category && (
                      <span className="mt-1 block truncate text-xs text-zinc-500">
                        {fact.category}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {editor.id ? "Edit fun fact" : "New fun fact"}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {editor.id ? "Changes are not saved until you click Save." : "Fill in the fields and save to add it."}
                </p>
              </div>
              <div className="flex gap-2">
                {editor.id && (
                  <button
                    type="button"
                    onClick={() => void deleteFact()}
                    disabled={mutationsBusy}
                    className="rounded-lg border border-red-900/70 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void saveFact()}
                  disabled={mutationsBusy || loading}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : editor.id ? "Save changes" : "Add fact"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs text-zinc-400">
                Title
                <input
                  value={editor.title}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, title: event.target.value }))
                  }
                  maxLength={120}
                  disabled={mutationsBusy || loading}
                  placeholder="Enter a short, clear title"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Explanation
                <textarea
                  value={editor.body}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, body: event.target.value }))
                  }
                  maxLength={5_000}
                  rows={8}
                  disabled={mutationsBusy || loading}
                  placeholder="Explain the fun fact…"
                  className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm leading-6 text-white"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Category (optional)
                <input
                  value={editor.category}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, category: event.target.value }))
                  }
                  maxLength={80}
                  disabled={mutationsBusy || loading}
                  placeholder="e.g. Science"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white"
                />
              </label>
            </div>
          </section>
        </div>
      </section>

      <details className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <summary className="cursor-pointer text-lg font-semibold">
          Bulk import or replace using JSON
        </summary>
        <p className="mt-2 text-sm text-zinc-400">
          Importing replaces the entire database. Category is optional; the limit
          is 200 facts.
        </p>
        <textarea
          value={json}
          disabled={mutationsBusy || loading}
          onChange={(event) => {
            setJson(event.target.value);
            setNotice("");
          }}
          spellCheck={false}
          aria-label="JSON fun facts list"
          className="mt-4 min-h-80 w-full resize-y rounded-xl border border-zinc-700 bg-[#09090f] p-4 font-mono text-sm leading-6 text-violet-100 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        />
        <button
          type="button"
          onClick={() => void importJson()}
          disabled={mutationsBusy || loading}
          className="mt-4 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Importing…" : "Validate JSON and replace all facts"}
        </button>
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Each item needs <code className="text-violet-300">title</code> and{" "}
          <code className="text-violet-300">body</code>. You can also add an
          optional <code className="text-violet-300">category</code>.
        </p>
      </details>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Public API</h2>
        <p className="mt-1 text-sm text-zinc-400">
          This endpoint is public and supports CORS. Every format returns the
          same single daily fact.
        </p>
        <div className="mt-4 grid gap-3">
          {[
            { format: "json", description: "Plain JSON for loading data on another page." },
            { format: "animated", description: "Animated HTML card for embedding in an iframe." },
            { format: "static", description: "Static HTML card for embedding in an iframe." },
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
