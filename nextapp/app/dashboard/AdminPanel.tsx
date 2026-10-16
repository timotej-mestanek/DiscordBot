"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import WheelAdminPanel from "@/app/dashboard/WheelAdminPanel";

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
  selfAccountId: string;
};

const currencyLabel = (currency: Currency) =>
  currency === "discord" ? "Discord body" : "Twitch CustomBody";

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

export default function AdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [revertingLogId, setRevertingLogId] = useState<string | null>(null);
  const [streamerBotLogs, setStreamerBotLogs] = useState<StreamerBotIntegrationLog[]>([]);
  const [streamerBotLogCursor, setStreamerBotLogCursor] = useState<string | null>(null);
  const [streamerBotLogError, setStreamerBotLogError] = useState("");
  const [loadingOlderStreamerBotLogs, setLoadingOlderStreamerBotLogs] = useState(false);

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
        setStreamerBotLogError(result.error ?? "Streamer.bot logy sa nepodarilo načítať.");
        return;
      }
      const page = result.logs as StreamerBotIntegrationLog[];
      setStreamerBotLogs((current) => (reset ? page : [...current, ...page]));
      setStreamerBotLogCursor(result.nextCursor ?? null);
    } catch (loadError) {
      console.error("Streamer.bot dashboard logs load failed:", loadError);
      setStreamerBotLogError("Streamer.bot logy sa nepodarilo načítať.");
    } finally {
      setLoadingOlderStreamerBotLogs(false);
    }
  }

  async function load() {
    try {
      void loadStreamerBotLogs(true);
      const response = await fetch("/api/admin");
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Admin data se nepodařilo načíst.");
        return;
      }
      setData(result as AdminData);
    } catch (loadError) {
      console.error("Admin data refresh failed:", loadError);
      setError("Admin data se nepodařilo načíst.");
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/streamerbot-logs")
      .then(async (response) => ({
        response,
        result: await response.json(),
      }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) {
          setStreamerBotLogError(
            result.error ?? "Streamer.bot logy sa nepodarilo načítať.",
          );
          return;
        }
        setStreamerBotLogs(result.logs as StreamerBotIntegrationLog[]);
        setStreamerBotLogCursor(result.nextCursor ?? null);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Streamer.bot dashboard logs load failed:", loadError);
        setStreamerBotLogError("Streamer.bot logy sa nepodarilo načítať.");
      });
    void fetch("/api/admin")
      .then(async (response) => ({
        response,
        result: await response.json(),
      }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "Admin data se nepodařilo načíst.");
          return;
        }
        setData(result as AdminData);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Admin data load failed:", loadError);
        setError("Admin data se nepodařilo načíst.");
      });
    return () => {
      active = false;
    };
  }, []);

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
        setError("Zkontroluj datum a čas začátku a konce streamu.");
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
        setError(result.error ?? "Změnu se nepodařilo uložit.");
        return;
      }
      await load();
    } catch (submitError) {
      console.error("Admin action request failed:", submitError);
      setError("Změnu se nepodařilo uložit.");
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
        setError(result.error ?? "Shop operaci se nepodařilo vrátit.");
        return;
      }
      await load();
    } catch (revertError) {
      console.error("Shop operation revert failed:", revertError);
      setError("Shop operaci se nepodařilo vrátit.");
    } finally {
      setRevertingLogId(null);
    }
  }

  if (!data) {
    return (
      <p role={error ? "alert" : undefined} className="text-sm text-zinc-400">
        {error || "Načítám administraci…"}
      </p>
    );
  }

  const directions: Array<[Currency, Currency]> = [
    ["discord", "twitch_custom"],
    ["twitch_custom", "discord"],
  ];

  return (
    <div className="space-y-8">
      <WheelAdminPanel />

      {error && (
        <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Kalendář streamů</h2>
        <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="action" value="stream-event-create" />
          <label className="text-sm text-zinc-300 sm:col-span-2">
            Název streamu
            <input
              name="title"
              required
              maxLength={120}
              placeholder="Např. Večerní stream"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Začátek
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Konec (nepovinné)
            <input
              name="endsAt"
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 sm:col-span-2">
            Přidat termín do kalendáře
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
                Odebrat termín
              </button>
            </form>
          ))}
          {data.streamEvents.length === 0 && (
            <p className="text-sm text-zinc-500">Kalendář zatím nemá žádné termíny.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Administrace shopu</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Všechny shop položky vytvářej a upravuj v jednom společném editoru.
        </p>
        <Link
          href="/shop"
          className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500"
        >
          Otevřít správu shopu
        </Link>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Uživatelé a administrátoři</h2>
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
                  {account.identities.map((identity) => `${identity.provider}: ${identity.display_name}`).join(" · ") || "Bez propojených účtů"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  name="role"
                  defaultValue={account.role}
                  disabled={account.id === data.selfAccountId}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
                  aria-label={`Role uživatele ${account.display_name}`}
                >
                  <option value="user">Uživatel</option>
                  <option value="admin">Admin</option>
                </select>
                <button disabled={account.id === data.selfAccountId} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">
                  Uložit
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Přidat nebo odebrat body</h2>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="action" value="adjust" />
          <label className="text-sm text-zinc-300">
            Uživatel
            <select name="accountId" required className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.display_name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Měna
            <select name="currency" required className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
              <option value="discord">Discord body</option>
              <option value="twitch_custom">Twitch CustomBody</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Změna bodů (záporné číslo odečte)
            <input name="delta" type="number" required min="-1000000000" max="1000000000" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
          </label>
          <label className="text-sm text-zinc-300">
            Důvod (zobrazí se v logu)
            <input name="reason" required maxLength={500} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
          </label>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 sm:col-span-2">
            Zapsat změnu
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Směnné kurzy</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Twitch Channel Points jsou z konverzí záměrně vynechané.
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
                  Konverze zapnutá
                </label>
                <button className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
                  Uložit kurz
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Změny bodů</h2>
        <div className="mt-4 max-h-[28rem] space-y-2 overflow-auto">
          {data.pointEvents.map((event) => (
            <article key={event.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
              <p className="font-medium">
                {event.delta > 0 ? "+" : ""}{event.delta.toLocaleString("cs-CZ")} · {currencyLabel(event.currency)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {new Date(event.created_at).toLocaleString("cs-CZ")} · ID {event.provider_user_id} · {event.actor?.display_name ?? "Streamer.bot / systém"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{event.reason}</p>
            </article>
          ))}
          {data.pointEvents.length === 0 && <p className="text-sm text-zinc-500">Zatím bez změn.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Auditní log</h2>
        <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto overscroll-contain">
          {data.logs.map((log) => (
            <article key={log.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {new Date(log.created_at).toLocaleString("cs-CZ")} · {log.actor?.display_name ?? "Systém"}
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
                      {revertingLogId === log.id ? "Vracím…" : "REVERT"}
                    </button>
                  )}
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-500">
                {JSON.stringify(log.details)}
              </pre>
            </article>
          ))}
          {data.logs.length === 0 && <p className="text-sm text-zinc-500">Zatím bez záznamů.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Streamer.bot API log</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Úspešné aj neúspešné požiadavky na Streamer.bot integrácie vrátane meny a kolies.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStreamerBotLogs(true)}
            disabled={loadingOlderStreamerBotLogs}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            Obnoviť log
          </button>
        </div>
        {streamerBotLogError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {streamerBotLogError}
          </p>
        )}
        <div className="mt-4 max-h-[36rem] space-y-2 overflow-auto">
          {streamerBotLogs.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-zinc-800 p-3 text-sm">
              <p className={entry.success ? "font-medium text-emerald-300" : "font-medium text-red-300"}>
                {entry.success ? "OK" : "ERROR"} · HTTP {entry.status_code} · {entry.operation ?? "unknown"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {new Date(entry.created_at).toLocaleString("cs-CZ")} · request {entry.request_id}
              </p>
              <p className="mt-2 text-xs text-zinc-500">Request</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-400">
                {entry.request_details ?? "Request body nebol uložený."}
              </pre>
              <p className="mt-2 text-xs text-zinc-500">Response</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-400">
                {entry.response_details}
              </pre>
            </article>
          ))}
          {streamerBotLogs.length === 0 && !streamerBotLogError && (
            <p className="text-sm text-zinc-500">Zatiaľ neboli zaznamenané žiadne požiadavky.</p>
          )}
        </div>
        {streamerBotLogCursor && (
          <button
            type="button"
            onClick={() => void loadStreamerBotLogs(false)}
            disabled={loadingOlderStreamerBotLogs}
            className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {loadingOlderStreamerBotLogs ? "Načítavam…" : "Načítať staršie logy"}
          </button>
        )}
      </section>
    </div>
  );
}
