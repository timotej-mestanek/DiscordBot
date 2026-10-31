"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type UserIdentity = { id: string; name: string; points: number };
type UserRow = {
  key: string;
  displayName: string;
  accountId: string | null;
  isTwitchFollower: boolean;
  goldenEggs: number | null;
  discord: UserIdentity | null;
  twitch: UserIdentity | null;
  shopInventory: Array<{ productId: string; name: string; quantity: number }>;
  blackMarketInventory: Array<{
    itemId: string;
    name: string;
    level: number;
    group: string;
    equipped: boolean;
  }>;
  crateInventory: Array<{ crateId: string; name: string; quantity: number }>;
};
type UsersData = {
  users: UserRow[];
  shopProducts: Array<{ id: string; name: string }>;
  blackMarketItems: Array<{ id: string; name: string; group: string }>;
  crates: Array<{ id: string; name: string }>;
};
type PointCurrency = "discord" | "twitch_custom";
type InventoryAction =
  | { action: "shop-item" | "crate-item" | "black-market-item"; itemId: string; operation: "add" | "remove"; accountId: string }
  | { action: "adjust-points"; providerUserId: string; currency: PointCurrency; delta: number; reason: string };

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
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pointDelta, setPointDelta] = useState("1");
  const [pointReason, setPointReason] = useState("Admin adjustment");

  const load = useCallback(async () => {
    try {
      const nextData = await fetchUsersData();
      setData(nextData);
      setSelectedUser((current) =>
        current ? nextData.users.find((user) => user.key === current.key) ?? null : null,
      );
      setError("");
    } catch (loadError) {
      console.error("Admin users load failed:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load users.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchUsersData()
      .then((nextData) => {
        if (active) setData(nextData);
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
      [
        user.displayName,
        user.discord?.name,
        user.discord?.id,
        user.twitch?.name,
        user.twitch?.id,
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query)),
    );
  }, [data, search]);

  async function submitAction(action: InventoryAction, key: string) {
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not save this change.");
        return;
      }
      await load();
    } catch (submitError) {
      console.error("Admin user management action failed:", submitError);
      setError("Could not save this change.");
    } finally {
      setBusy("");
    }
  }

  function adjustPoints(event: FormEvent<HTMLFormElement>, currency: PointCurrency) {
    event.preventDefault();
    if (!selectedUser) return;
    const identity = currency === "discord" ? selectedUser.discord : selectedUser.twitch;
    const delta = Number(pointDelta);
    if (!identity || !Number.isSafeInteger(delta) || delta === 0 || !pointReason.trim()) {
      setError("Enter a non-zero whole number and a reason for the point adjustment.");
      return;
    }
    void submitAction(
      {
        action: "adjust-points",
        providerUserId: identity.id,
        currency,
        delta,
        reason: pointReason.trim(),
      },
      `points-${selectedUser.key}-${currency}`,
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : (
          <p className="text-sm text-zinc-400">Loading users…</p>
        )}
      </div>
    );
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
                  <div className="space-y-1 text-xs text-zinc-300">
                    {user.discord && <p>Discord: {user.discord.points.toLocaleString()}</p>}
                    {user.twitch && <p>Twitch: {user.twitch.points.toLocaleString()}</p>}
                    {!user.discord && !user.twitch && <span className="text-zinc-500">—</span>}
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-300">
                  {user.goldenEggs === null ? "—" : user.goldenEggs.toLocaleString()}
                </td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setPointDelta("1");
                      setPointReason("Admin adjustment");
                      setSelectedUser(user);
                    }}
                    className="rounded-lg border border-violet-700/70 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-950/60"
                  >
                    Manage
                  </button>
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
      {error && (
        <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {selectedUser && data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setSelectedUser(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-management-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
                  User management
                </p>
                <h2 id="user-management-title" className="mt-1 text-2xl font-bold">
                  {selectedUser.displayName}
                </h2>
              </div>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setSelectedUser(null)}
                aria-label="Close user management"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <h3 className="font-semibold">Adjust points</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Enter a positive or negative amount. A reason is recorded in the admin ledger.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {([
                  ["discord", selectedUser.discord, "Discord"],
                  ["twitch_custom", selectedUser.twitch, "Twitch"],
                ] as const).map(([currency, identity, label]) => (
                  identity && (
                    <form
                      key={currency}
                      onSubmit={(event) => adjustPoints(event, currency)}
                      className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                    >
                      <p className="text-sm font-medium">{label}: {identity.points.toLocaleString()}</p>
                      <label className="mt-3 block text-xs text-zinc-400">
                        Change
                        <input
                          type="number"
                          step="1"
                          value={pointDelta}
                          onChange={(event) => setPointDelta(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="mt-2 block text-xs text-zinc-400">
                        Reason
                        <input
                          type="text"
                          maxLength={500}
                          value={pointReason}
                          onChange={(event) => setPointReason(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={Boolean(busy)}
                        className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold hover:bg-violet-500 disabled:opacity-50"
                      >
                        {busy === `points-${selectedUser.key}-${currency}` ? "Saving…" : "Update points"}
                      </button>
                    </form>
                  )
                ))}
              </div>
            </section>

            {selectedUser.accountId ? (
            <>
            <section className="mt-6">
              <h3 className="text-lg font-semibold">Shop inventory</h3>
              <div className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                {data.shopProducts.map((product) => {
                  const quantity = selectedUser.shopInventory.find(
                    (item) => item.productId === product.id,
                  )?.quantity ?? 0;
                  return (
                    <div key={product.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-sm text-zinc-200">{product.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Remove one ${product.name}`}
                          disabled={Boolean(busy) || quantity === 0}
                          onClick={() => void submitAction(
                            { action: "shop-item", accountId: selectedUser.accountId!, itemId: product.id, operation: "remove" },
                            `shop-${product.id}`,
                          )}
                          className="h-8 w-8 rounded-md border border-zinc-700 text-lg hover:bg-zinc-800 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${product.name}`}
                          disabled={Boolean(busy)}
                          onClick={() => void submitAction(
                            { action: "shop-item", accountId: selectedUser.accountId!, itemId: product.id, operation: "add" },
                            `shop-${product.id}`,
                          )}
                          className="h-8 w-8 rounded-md border border-zinc-700 text-lg hover:bg-zinc-800 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                {data.shopProducts.length === 0 && (
                  <p className="p-3 text-sm text-zinc-500">No shop items are available.</p>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-lg font-semibold">Black Market items</h3>
              <div className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                {data.blackMarketItems.map((item) => {
                  const owned = selectedUser.blackMarketInventory.find(
                    (entry) => entry.itemId === item.id,
                  );
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-sm text-zinc-200">
                        {item.name}
                        {owned && <span className="ml-2 text-xs text-zinc-500">Level {owned.level}</span>}
                      </span>
                      <button
                        type="button"
                        disabled={Boolean(busy) || (!owned && !selectedUser.accountId)}
                        onClick={() => void submitAction(
                          {
                            action: "black-market-item",
                            accountId: selectedUser.accountId!,
                            itemId: item.id,
                            operation: owned ? "remove" : "add",
                          },
                          `black-market-${item.id}`,
                        )}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                          owned
                            ? "border border-red-900/70 text-red-300 hover:bg-red-950/50"
                            : "border border-emerald-900/70 text-emerald-300 hover:bg-emerald-950/50"
                        }`}
                      >
                        {owned ? "Remove" : "Add"}
                      </button>
                    </div>
                  );
                })}
                {data.blackMarketItems.length === 0 && (
                  <p className="p-3 text-sm text-zinc-500">No Black Market items are available.</p>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-lg font-semibold">Crates</h3>
              <div className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                {data.crates.map((crate) => {
                  const quantity = selectedUser.crateInventory.find(
                    (entry) => entry.crateId === crate.id,
                  )?.quantity ?? 0;
                  return (
                    <div key={crate.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-sm text-zinc-200">{crate.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Remove one ${crate.name}`}
                          disabled={Boolean(busy) || quantity === 0}
                          onClick={() => void submitAction(
                            { action: "crate-item", accountId: selectedUser.accountId!, itemId: crate.id, operation: "remove" },
                            `crate-${crate.id}`,
                          )}
                          className="h-8 w-8 rounded-md border border-zinc-700 text-lg hover:bg-zinc-800 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${crate.name}`}
                          disabled={Boolean(busy)}
                          onClick={() => void submitAction(
                            { action: "crate-item", accountId: selectedUser.accountId!, itemId: crate.id, operation: "add" },
                            `crate-${crate.id}`,
                          )}
                          className="h-8 w-8 rounded-md border border-zinc-700 text-lg hover:bg-zinc-800 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                {data.crates.length === 0 && (
                  <p className="p-3 text-sm text-zinc-500">No crates are available.</p>
                )}
              </div>
            </section>
            </>
            ) : (
              <p className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
                This user does not have a linked dashboard account, so there is no account inventory to manage yet.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
