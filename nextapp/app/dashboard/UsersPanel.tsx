"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UserInventoryManager from "@/app/dashboard/UserInventoryManager";
import UserPointsEditor from "@/app/dashboard/UserPointsEditor";
import type { InventoryAction, PointCurrency, UsersData, UserRow } from "@/app/dashboard/users-types";

async function fetchUsersData(): Promise<UsersData> {
  const response = await fetch("/api/admin/users");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load users.");
  return result as UsersData;
}

function PlatformBadge({
  provider,
  connected,
}: {
  provider: "discord" | "twitch";
  connected: boolean;
}) {
  const label = provider === "discord" ? "Discord" : "Twitch";
  return (
    <span
      title={connected ? `${label} connected` : `${label} not connected`}
      aria-label={connected ? `${label} connected` : `${label} not connected`}
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold ${
        connected
          ? provider === "discord"
            ? "bg-indigo-500/20 text-indigo-300"
            : "bg-purple-500/20 text-purple-300"
          : "bg-zinc-800 text-zinc-600"
      }`}
    >
      {provider === "discord" ? "D" : "T"}
    </span>
  );
}

export default function UsersPanel() {
  const [data, setData] = useState<UsersData | null>(null);
  const [inventoryUser, setInventoryUser] = useState<UserRow | null>(null);
  const [pointsEdit, setPointsEdit] = useState<{
    user: UserRow;
    currency: PointCurrency;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const nextData = await fetchUsersData();
      setData(nextData);
      setInventoryUser((current) =>
        current ? nextData.users.find((user) => user.key === current.key) ?? null : null,
      );
      setPointsEdit((current) => {
        if (!current) return null;
        const user = nextData.users.find((entry) => entry.key === current.user.key);
        return user ? { ...current, user } : null;
      });
      setError("");
    } catch (loadError) {
      console.error("Admin users load failed:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load users.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchUsersData()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Admin users load failed:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Could not load users.");
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return data?.users ?? [];
    return (data?.users ?? []).filter((user) =>
      [user.displayName, user.discord?.name, user.twitch?.name]
        .filter((name): name is string => Boolean(name))
        .some((name) => name.toLocaleLowerCase().includes(query)),
    );
  }, [data, search]);

  async function submitAction(action: InventoryAction): Promise<boolean> {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setActionError(result.error ?? "Could not save this change.");
        return false;
      }
      await load();
      return true;
    } catch (submitError) {
      console.error("Admin user management action failed:", submitError);
      setActionError("Could not save this change.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePoints(delta: number, reason: string) {
    const { user, currency } = pointsEdit!;
    const identity = currency === "discord" ? user.discord : user.twitch;
    if (!identity) return;
    if (await submitAction({
      action: "adjust-points",
      providerUserId: identity.id,
      currency,
      delta,
      reason,
    })) {
      setPointsEdit(null);
    }
  }

  if (!data) {
    return error
      ? <p role="alert" className="text-sm text-red-300">{error}</p>
      : <p className="text-sm text-zinc-400">Loading users…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-200/90">
        Users include chat activity, platform point records, linked dashboard accounts, and Twitch follow events received after the Streamer.bot action is enabled. Existing followers are not backfilled, and unfollows are not tracked.
      </p>
      <label className="block">
        <span className="sr-only">Search users by name</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users by name…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-500"
        />
      </label>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-3">User</th>
              <th scope="col" className="px-4 py-3">Points</th>
              <th scope="col" className="px-4 py-3">Golden eggs</th>
              <th scope="col" className="px-4 py-3">Inventory</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {visibleUsers.map((user) => (
              <tr key={user.key} className="align-top hover:bg-zinc-800/30">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-100">{user.displayName}</span>
                    <PlatformBadge provider="twitch" connected={Boolean(user.twitch)} />
                    <PlatformBadge provider="discord" connected={Boolean(user.discord)} />
                    {user.isTwitchFollower && (
                      <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Follower
                      </span>
                    )}
                  </div>
                  {(user.twitch || user.discord) && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {[user.twitch?.name, user.discord?.name]
                        .filter((name) => name && name !== user.displayName)
                        .join(" · ")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-2 text-xs text-zinc-300">
                    {user.discord && (
                      <PointBalance
                        label="Discord"
                        points={user.discord.points}
                        onEdit={() => openPointsEditor(user, "discord")}
                      />
                    )}
                    {user.twitch && (
                      <PointBalance
                        label="Twitch"
                        points={user.twitch.points}
                        onEdit={() => openPointsEditor(user, "twitch_custom")}
                      />
                    )}
                    {!user.discord && !user.twitch && <span className="text-zinc-500">—</span>}
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-300">
                  {user.goldenEggs === null ? "—" : user.goldenEggs.toLocaleString()}
                </td>
                <td className="px-4 py-4">
                  {user.accountId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError("");
                        setInventoryUser(user);
                      }}
                      className="rounded-lg border border-violet-700/70 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-950/60"
                    >
                      Manage
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-500">No account inventory</span>
                  )}
                </td>
              </tr>
            ))}
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No users match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Showing {visibleUsers.length.toLocaleString()} of {data.users.length.toLocaleString()} users.
      </p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      {pointsEdit && (
        <UserPointsEditor
          userName={pointsEdit.user.displayName}
          currency={pointsEdit.currency}
          identity={(pointsEdit.currency === "discord"
            ? pointsEdit.user.discord
            : pointsEdit.user.twitch)!}
          busy={busy}
          error={actionError}
          onClose={() => setPointsEdit(null)}
          onSave={(delta, reason) => void savePoints(delta, reason)}
        />
      )}
      {inventoryUser?.accountId && (
        <UserInventoryManager
          user={inventoryUser}
          accountId={inventoryUser.accountId}
          data={data}
          busy={busy}
          error={actionError}
          onClose={() => setInventoryUser(null)}
          onAction={(action) => void submitAction(action)}
        />
      )}
    </div>
  );

  function openPointsEditor(user: UserRow, currency: PointCurrency) {
    setActionError("");
    setPointsEdit({ user, currency });
  }
}

function PointBalance({
  label,
  points,
  onEdit,
}: {
  label: string;
  points: number;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}: {points.toLocaleString()}</span>
      <button
        type="button"
        onClick={onEdit}
        className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-semibold text-violet-200 hover:bg-zinc-800"
      >
        Edit points
      </button>
    </div>
  );
}
