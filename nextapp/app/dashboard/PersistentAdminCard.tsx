"use client";

import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

function cookieName(id: string) {
  return `n4jt_admin_card_${id}`;
}

function subscribeToCardChanges(onChange: () => void) {
  window.addEventListener("n4jt-admin-card-change", onChange);
  return () => window.removeEventListener("n4jt-admin-card-change", onChange);
}

function isCardCollapsed(id: string) {
  const prefix = `${cookieName(id)}=`;
  return (
    document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(prefix))
      ?.slice(prefix.length) === "hidden"
  );
}

export default function PersistentAdminCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const collapsed = useSyncExternalStore(
    subscribeToCardChanges,
    () => isCardCollapsed(id),
    () => false,
  );

  function toggle() {
    const next = !collapsed;
    document.cookie = `${cookieName(id)}=${next ? "hidden" : "shown"}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.dispatchEvent(new Event("n4jt-admin-card-change"));
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={toggle}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </header>
      {!collapsed && <div>{children}</div>}
    </section>
  );
}
