"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_REQUEST_EVENT,
  getCookieConsent,
  setCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsent>("unset");
  const [requested, setRequested] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const syncConsent = () => setConsent(getCookieConsent());
    const openConsent = () => setRequested(true);
    syncConsent();
    window.addEventListener(COOKIE_CONSENT_EVENT, syncConsent);
    window.addEventListener(COOKIE_CONSENT_REQUEST_EVENT, openConsent);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, syncConsent);
      window.removeEventListener(COOKIE_CONSENT_REQUEST_EVENT, openConsent);
    };
  }, []);

  function chooseConsent(value: "accepted" | "declined") {
    setCookieConsent(value);
    setConsent(value);
    setRequested(false);
  }

  if (pathname.startsWith("/overlays/")) return null;

  if (consent !== "unset" && !requested) {
    return (
      <button
        type="button"
        onClick={() => {
          setRequested(true);
        }}
        className="fixed bottom-3 right-3 z-[90] rounded-full border border-zinc-700 bg-[#202020]/90 px-3 py-2 text-[10px] font-medium text-zinc-300 shadow-lg hover:text-white"
        aria-label="Změnit nastavení cookies"
      >
        Nastavení cookies
      </button>
    );
  }

  return (
    <aside
      aria-label="Nastavení cookies a místního úložiště"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-zinc-700 bg-[#202020] p-4 text-zinc-100 shadow-2xl sm:inset-x-6 sm:p-5"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
    >
      <h2 id="cookie-consent-title" className="text-sm font-semibold">
        {requested ? "Povolit místní úložiště?" : "Cookies a místní úložiště"}
      </h2>
      <p className="mt-1.5 text-xs leading-5 text-zinc-300">
        {requested
          ? "Uložení LED návrhu vyžaduje souhlas s volitelným místním úložištěm. Volba se uloží do cookies a můžeš ji kdykoli změnit."
          : "Nezbytné cookies používáme pro přihlášení. Volitelné místní úložiště slouží k uložení LED návrhů v tomto prohlížeči. Bez souhlasu se LED návrhy neukládají."}
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => chooseConsent("declined")}
          className="rounded border border-zinc-600 px-3 py-2 text-xs font-semibold hover:bg-zinc-700"
        >
          Odmítnout
        </button>
        {requested && consent !== "unset" && (
          <button
            type="button"
            onClick={() => setRequested(false)}
            className="rounded border border-zinc-600 px-3 py-2 text-xs font-semibold hover:bg-zinc-700"
          >
            Zrušit
          </button>
        )}
        <button
          type="button"
          onClick={() => chooseConsent("accepted")}
          className="rounded bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
        >
          Přijmout
        </button>
      </div>
    </aside>
  );
}
