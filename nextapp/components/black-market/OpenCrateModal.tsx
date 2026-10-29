"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { openCrate } from "@/lib/black-market/actions";
import type { OpenCrateResult } from "@/lib/black-market/actions";
import { errorMessage } from "./error-messages";
import type { BlackMarketCrate } from "./types";

export default function OpenCrateModal({
  accountId,
  crate,
  onClose,
  onQuantityChange,
  onSuccess,
  onError,
}: {
  accountId: string;
  crate: BlackMarketCrate;
  onClose: () => void;
  onQuantityChange: (crateId: string, delta: number) => void;
  onSuccess: (result: Exclude<OpenCrateResult, { type: "error" }>) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    Exclude<OpenCrateResult, { type: "error" }> | null
  >(null);
  const [hasSucceeded, setHasSucceeded] = useState(false);

  async function handleOpen() {
    if (pending || crate.quantity < 1) return;
    setPending(true);
    onError("");
    onQuantityChange(crate.id, -1);

    let response: OpenCrateResult;
    try {
      response = await openCrate(accountId, crate.id);
    } catch (error) {
      console.error("Black Market crate opening failed:", error);
      onQuantityChange(crate.id, 1);
      onError(errorMessage("INTERNAL_ERROR"));
      setPending(false);
      return;
    }

    setPending(false);
    if (response.type === "error") {
      onQuantityChange(crate.id, 1);
      onError(errorMessage(response.code));
      return;
    }

    setResult(response);
    setHasSucceeded(true);
    onSuccess(response);
  }

  function close() {
    if (hasSucceeded) router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-crate-title"
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
              Black Market
            </p>
            <h2 id="open-crate-title" className="mt-2 text-2xl font-black">
              {crate.name}
            </h2>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={close}
            className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {pending ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
            <p className="text-sm text-zinc-300">Opening...</p>
          </div>
        ) : result?.type === "item" ? (
          <div className="mt-5">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
              {result.imageUrl ? (
                <Image
                  src={result.imageUrl}
                  alt={result.itemName}
                  fill
                  unoptimized
                  sizes="400px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl text-zinc-700" aria-hidden="true">◇</div>
              )}
            </div>
            <h3 className="mt-4 text-center text-xl font-black">{result.itemName}</h3>
            <p className="mt-1 text-center text-sm text-emerald-300">
              Added to inventory!
            </p>
          </div>
        ) : result?.type === "duplicate" ? (
          <div className="mt-8 rounded-xl border border-amber-700/60 bg-amber-950/40 p-8 text-center">
            <p className="text-6xl" aria-hidden="true">🥚</p>
            <p className="mt-3 text-2xl font-black text-amber-100">
              +{result.goldenEggsGained} Golden Eggs
            </p>
            <p className="mt-1 text-sm text-amber-100/70">Duplicate item</p>
          </div>
        ) : (
          <div className="my-8 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-center">
            <p className="text-sm text-zinc-400">
              You have {crate.quantity} {crate.quantity === 1 ? "crate" : "crates"}.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          {result && crate.quantity > 0 && (
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
            >
              Open another
            </button>
          )}
          {!result && !pending && (
            <button
              type="button"
              disabled={crate.quantity < 1}
              onClick={() => void handleOpen()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Open crate
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
