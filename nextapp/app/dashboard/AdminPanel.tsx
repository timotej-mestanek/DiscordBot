"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import PersistentAdminCard from "@/app/dashboard/PersistentAdminCard";

type Currency = "discord" | "twitch_custom";
type Account = {
  id: string;
  display_name: string;
  role: "user" | "admin";
  identities: Array<{
    provider: string;
    provider_user_id: string;
    display_name: string;
  }>;
};
type Rate = {
  source_currency: Currency;
  target_currency: Currency;
  source_amount: number;
  target_amount: number;
  enabled: boolean;
};
type Log = {
  id: string;
  reverted_log_id: string | null;
  action: string;
  details: unknown;
  created_at: string;
  actor: { display_name: string } | null;
  target: { display_name: string } | null;
};
type PointEvent = {
  id: string;
  currency: Currency;
  provider_user_id: string;
  delta: number;
  reason: string;
  created_at: string;
  actor: { display_name: string } | null;
};
type StreamerBotIntegrationLog = {
  id: string;
  request_id: string;
  operation: string | null;
  success: boolean;
  status_code: number;
  request_details: string | null;
  response_details: string;
  created_at: string;
};
type StreamEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
};
type AdminData = {
  accounts: Account[];
  rates: Rate[];
  logs: Log[];
  pointEvents: PointEvent[];
  streamEvents: StreamEvent[];
  pubgPlayerName: string;
  pubgTeammates: string[];
  selfAccountId: string;
};

const currencyLabel = (currency: Currency) =>
  currency === "discord" ? "Discord points" : "Twitch CustomBody";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canRevertShopLog(log: Log): boolean {
  if (log.action === "shop.product_created") return true;
  if (!isRecord(log.details)) return false;
  const details = log.details;
  if (log.action === "shop.product_updated") {
    return isRecord(details.before);
  }
  if (log.action === "shop.purchased") {
    return (
      typeof details.productId === "string" &&
      (details.currency === "discord" || details.currency === "twitch_custom") &&
      typeof details.price === "number"
    );
  }
  if (log.action === "shop.redeemed") {
    return (
      typeof details.productId === "string" &&
      typeof details.redemptionId === "string"
    );
  }
  return false;
}

export default function AdminPanel({ view }: { view: "settings" | "logs" }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [revertingLogId, setRevertingLogId] = useState<string | null>(null);
  const [streamerBotLogs, setStreamerBotLogs] = useState<StreamerBotIntegrationLog[]>([]);
  const [streamerBotLogCursor, setStreamerBotLogCursor] = useState<string | null>(null);
  const [streamerBotLogError, setStreamerBotLogError] = useState("");
  const [loadingOlderStreamerBotLogs, setLoadingOlderStreamerBotLogs] = useState(false);
  const [pubgPlayerName, setPubgPlayerName] = useState<string | null>(null);
  const [pubgTeammates, setPubgTeammates] = useState<string | null>(null);
  const [savingPubgRoster, setSavingPubgRoster] = useState(false);
  const [pubgRosterSaved, setPubgRosterSaved] = useState(false);

  async function loadStreamerBotLogs(reset: boolean) {
    setStreamerBotLogError("");
    setLoadingOlderStreamerBotLogs(!reset);
    try {
      const cursor = reset ? null : streamerBotLogCursor;
      const url = cursor
        ? `/api/admin/streamerbot-logs?cursor=${encodeURIComponent(cursor)}`
        : "/api/admin/streamerbot-logs";
      const response = await fetch(url);
      const result = await response.json();
      if (!response.ok) {
        setStreamerBotLogError(result.error ?? "Could not load Streamer.bot logs.");
        return;
      }
      const page = result.logs as StreamerBotIntegrationLog[];
      setStreamerBotLogs((current) => (reset ? page : [...current, ...page]));
      setStreamerBotLogCursor(result.nextCursor ?? null);
    } catch (loadError) {
      console.error("Streamer.bot dashboard logs load failed:", loadError);
      setStreamerBotLogError("Could not load Streamer.bot logs.");
    } finally {
      setLoadingOlderStreamerBotLogs(false);
    }
  }

  async function load() {
    try {
      if (view === "logs") void loadStreamerBotLogs(true);
      const response = await fetch("/api/admin");
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not load admin data.");
        return;
      }
      setData(result as AdminData);
    } catch (loadError) {
      console.error("Admin data refresh failed:", loadError);
      setError("Could not load admin data.");
    }
  }

  useEffect(() => {
    let active = true;
    if (view === "logs") {
      void fetch("/api/admin/streamerbot-logs")
      .then(async (response) => ({
        response,
        result: await response.json(),
      }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) {
          setStreamerBotLogError(
            result.error ?? "Could not load Streamer.bot logs.",
          );
          return;
        }
        setStreamerBotLogs(result.logs as StreamerBotIntegrationLog[]);
        setStreamerBotLogCursor(result.nextCursor ?? null);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Streamer.bot dashboard logs load failed:", loadError);
        setStreamerBotLogError("Could not load Streamer.bot logs.");
      });
    }
    void fetch("/api/admin")
      .then(async (response) => ({
        response,
        result: await response.json(),
      }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "Could not load admin data.");
          return;
        }
        setData(result as AdminData);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Admin data load failed:", loadError);
        setError("Could not load admin data.");
      });
    return () => {
      active = false;
    };
  }, [view]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const action = fields.action;
    const payload: Record<string, unknown> = { ...fields };
    if (action === "adjust") payload.delta = Number(fields.delta);
    if (action === "stream-event-create") {
      const startsAt = new Date(String(fields.startsAt));
      const endsAt = fields.endsAt ? new Date(String(fields.endsAt)) : null;
      if (
        Number.isNaN(startsAt.getTime()) ||
        (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))
      ) {
        setError("Check the stream start and end date and time.");
        return;
      }
      payload.startsAt = startsAt.toISOString();
      payload.endsAt = endsAt?.toISOString() ?? null;
    }
    if (action === "rate") {
      payload.sourceAmount = Number(fields.sourceAmount);
      payload.targetAmount = Number(fields.targetAmount);
      payload.enabled = fields.enabled === "true";
    }
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not save the change.");
        return;
      }
      await load();
    } catch (submitError) {
      console.error("Admin action request failed:", submitError);
      setError("Could not save the change.");
      return;
    }
    form.reset();
  }

  async function revertShopOperation(logId: string) {
    setError("");
    setRevertingLogId(logId);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "shop-revert", logId }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not revert the shop operation.");
        return;
      }
      await load();
    } catch (revertError) {
      console.error("Shop operation revert failed:", revertError);
      setError("Could not revert the shop operation.");
    } finally {
      setRevertingLogId(null);
    }
  }

  async function savePubgRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPubgRosterSaved(false);
    setSavingPubgRoster(true);
    const teammateNames = (pubgTeammates ?? data?.pubgTeammates.join("\n") ?? "")
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);
    const playerName = (pubgPlayerName ?? data?.pubgPlayerName ?? "N4JTIK").trim();
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "gamestats-pubg",
          playerName,
          teammates: teammateNames,
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not save the PUBG roster.");
        return;
      }
      setPubgPlayerName(playerName);
      setPubgTeammates(teammateNames.join("\n"));
      await load();
      setPubgRosterSaved(true);
    } catch (saveError) {
      console.error("PUBG roster save failed:", saveError);
      setError("Could not save the PUBG roster.");
    } finally {
      setSavingPubgRoster(false);
    }
  }

  if (!data) {
    return (
      <p role={error ? "alert" : undefined} className="text-sm text-zinc-400">
        {error || "Loading administration…"}
      </p>
    );
  }

  const directions: Array<[Currency, Currency]> = [
    ["discord", "twitch_custom"],
    ["twitch_custom", "discord"],
  ];

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {view === "settings" && (
      <>
      <PersistentAdminCard id="stream-schedule" title="Stream schedule">
        <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="action" value="stream-event-create" />
          <label className="text-sm text-zinc-300 sm:col-span-2">
            Stream title
            <input
              name="title"
              required
              maxLength={120}
              placeholder="e.g. Evening stream"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Starts
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Ends (optional)
            <input
              name="endsAt"
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 sm:col-span-2">
            Add to schedule
          </button>
        </form>

        <div className="mt-5 space-y-2">
          {data.streamEvents.map((event) => (
            <form
              key={event.id}
              onSubmit={submit}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3"
            >
              <input type="hidden" name="action" value="stream-event-delete" />
              <input type="hidden" name="eventId" value={event.id} />
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(event.starts_at).toLocaleString("cs-CZ", {
                    timeZone: "Europe/Prague",
                  })}
                  {event.ends_at
                    ? ` – ${new Date(event.ends_at).toLocaleString("cs-CZ", {
                        timeZone: "Europe/Prague",
                      })}`
                    : ""}
                </p>
              </div>
              <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-800 hover:text-red-300">
                Remove event
              </button>
            </form>
          ))}
          {data.streamEvents.length === 0 && (
            <p className="text-sm text-zinc-500">There are no scheduled events yet.</p>
          )}
        </div>
      </PersistentAdminCard>

      <PersistentAdminCard id="pubg-roster" title="Game stats · PUBG sestava">
        <p className="mt-2 text-sm text-zinc-400">
          Set the PUBG account and up to three teammates. Names are saved for a future game-statistics source;
          the extension currently only receives and displays data.
        </p>
        <form onSubmit={savePubgRoster} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-300">
            Your PUBG username
            <input
              value={pubgPlayerName ?? data.pubgPlayerName}
              onChange={(event) => {
                setPubgPlayerName(event.target.value);
                setPubgRosterSaved(false);
              }}
              required
              maxLength={32}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Teammates (one per line, up to three)
            <textarea
              value={pubgTeammates ?? data.pubgTeammates.join("\n")}
              onChange={(event) => {
                setPubgTeammates(event.target.value);
                setPubgRosterSaved(false);
              }}
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              disabled={savingPubgRoster}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
            >
              {savingPubgRoster ? "Saving…" : "Save PUBG roster"}
            </button>
            {pubgRosterSaved && (
              <p role="status" className="text-sm text-emerald-300">PUBG roster saved.</p>
            )}
          </div>
        </form>
      </PersistentAdminCard>

      <PersistentAdminCard id="users-admins" title="Users and administrators">
        <div className="mt-4 space-y-3">
          {data.accounts.map((account) => (
            <form
              key={`${account.id}-${account.role}`}
              onSubmit={submit}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3"
            >
              <input type="hidden" name="action" value="role" />
              <input type="hidden" name="accountId" value={account.id} />
              <div>
                <p className="font-medium">{account.display_name}</p>
                <p className="text-xs text-zinc-500">
                  {account.identities.map((identity) => `${identity.provider}: ${identity.display_name}`).join(" · ") || "No linked accounts"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  name="role"
                  defaultValue={account.role}
                  disabled={account.id === data.selfAccountId}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
                  aria-label={`${account.display_name}'s role`}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button disabled={account.id === data.selfAccountId} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">
                  Save
                </button>
              </div>
            </form>
          ))}
        </div>
      </PersistentAdminCard>

      <PersistentAdminCard id="point-adjustments" title="Add or remove points">
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="action" value="adjust" />
          <label className="text-sm text-zinc-300">
            User
            <select name="accountId" required className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.display_name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Currency
            <select name="currency" required className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
              <option value="discord">Discord points</option>
              <option value="twitch_custom">Twitch CustomBody</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Point adjustment (negative values subtract)
            <input name="delta" type="number" required min="-1000000000" max="1000000000" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
          </label>
          <label className="text-sm text-zinc-300">
            Reason (shown in the log)
            <input name="reason" required maxLength={500} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
          </label>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 sm:col-span-2">
            Apply adjustment
          </button>
        </form>
      </PersistentAdminCard>

      <PersistentAdminCard id="exchange-rates" title="Exchange rates">
        <p className="mt-2 text-sm text-zinc-400">
          Twitch Channel Points are intentionally excluded from conversions.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {directions.map(([source, target]) => {
            const rate = data.rates.find(
              (entry) => entry.source_currency === source && entry.target_currency === target,
            );
            return (
              <form key={`${source}-${target}-${rate?.source_amount ?? 0}-${rate?.target_amount ?? 0}-${rate?.enabled ?? false}`} onSubmit={submit} className="rounded-lg border border-zinc-800 p-4">
                <input type="hidden" name="action" value="rate" />
                <input type="hidden" name="source" value={source} />
                <input type="hidden" name="target" value={target} />
                <h3 className="font-semibold">{currencyLabel(source)} → {currencyLabel(target)}</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-sm text-zinc-300">
                    {currencyLabel(source)}
                    <input name="sourceAmount" type="number" min="1" max="1000000000" required defaultValue={rate?.source_amount ?? ""} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
                  </label>
                  <label className="text-sm text-zinc-300">
                    {currencyLabel(target)}
                    <input name="targetAmount" type="number" min="1" max="1000000000" required defaultValue={rate?.target_amount ?? ""} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
                  </label>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
                  <input name="enabled" type="checkbox" value="true" defaultChecked={rate?.enabled ?? false} />
                  Enable conversion
                </label>
                <button className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
                  Save rate
                </button>
              </form>
            );
          })}
        </div>
      </PersistentAdminCard>

      </>
      )}
      {view === "logs" && (
      <>
      <PersistentAdminCard id="point-changes" title="Point changes">
        <div className="mt-4 h-72 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-zinc-800 p-2">
          {data.pointEvents.map((event) => (
            <article key={event.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
              <p className="font-medium">
                {event.delta > 0 ? "+" : ""}{event.delta.toLocaleString("en-US")} · {currencyLabel(event.currency)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {new Date(event.created_at).toLocaleString("en-GB")} · ID {event.provider_user_id} · {event.actor?.display_name ?? "Streamer.bot / system"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{event.reason}</p>
            </article>
          ))}
          {data.pointEvents.length === 0 && <p className="text-sm text-zinc-500">No changes yet.</p>}
        </div>
      </PersistentAdminCard>

      <PersistentAdminCard id="audit-log" title="Audit log">
        <div className="mt-4 h-96 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-zinc-800 p-2">
          {data.logs.map((log) => (
            <article key={log.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {new Date(log.created_at).toLocaleString("en-GB")} · {log.actor?.display_name ?? "System"}
                    {log.target ? ` → ${log.target.display_name}` : ""}
                  </p>
                </div>
                {canRevertShopLog(log) &&
                  !data.logs.some((entry) => entry.reverted_log_id === log.id) && (
                    <button
                      type="button"
                      disabled={revertingLogId !== null}
                      onClick={() => void revertShopOperation(log.id)}
                      className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-950 disabled:opacity-50"
                    >
                      {revertingLogId === log.id ? "Reverting…" : "REVERT"}
                    </button>
                  )}
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-500">
                {JSON.stringify(log.details)}
              </pre>
            </article>
          ))}
          {data.logs.length === 0 && <p className="text-sm text-zinc-500">No entries yet.</p>}
        </div>
      </PersistentAdminCard>

      <PersistentAdminCard id="streamerbot-api-log" title="Streamer.bot API log">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mt-1 text-sm text-zinc-400">
              Successful and failed Streamer.bot integration requests, including currency and wheel operations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStreamerBotLogs(true)}
            disabled={loadingOlderStreamerBotLogs}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh logs
          </button>
        </div>
        {streamerBotLogError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {streamerBotLogError}
          </p>
        )}
        <div className="mt-4 h-[36rem] space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-zinc-800 p-2">
          {streamerBotLogs.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
              <p className={entry.success ? "font-medium text-emerald-300" : "font-medium text-red-300"}>
                {entry.success ? "OK" : "ERROR"} · HTTP {entry.status_code} · {entry.operation ?? "unknown"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {new Date(entry.created_at).toLocaleString("en-GB")} · request {entry.request_id}
              </p>
              <p className="mt-2 text-xs text-zinc-500">Request</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-400">
                {entry.request_details ?? "Request body was not saved."}
              </pre>
              <p className="mt-2 text-xs text-zinc-500">Response</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-400">
                {entry.response_details}
              </pre>
            </article>
          ))}
          {streamerBotLogs.length === 0 && !streamerBotLogError && (
            <p className="text-sm text-zinc-500">No requests have been recorded yet.</p>
          )}
        </div>
        {streamerBotLogCursor && (
          <button
            type="button"
            onClick={() => void loadStreamerBotLogs(false)}
            disabled={loadingOlderStreamerBotLogs}
            className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {loadingOlderStreamerBotLogs ? "Loading…" : "Load older logs"}
          </button>
        )}
      </PersistentAdminCard>
      </>
      )}
    </div>
  );
}
