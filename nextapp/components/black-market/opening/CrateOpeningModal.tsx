"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openCrate } from "@/lib/black-market/actions";
import type { OpenCrateResult } from "@/lib/black-market/actions";
import { errorMessage } from "../error-messages";
import type { BlackMarketCrate } from "../types";
import SimpleOpenCrateModal from "../SimpleOpenCrateModal";
import ItemReveal from "./ItemReveal";

type SuccessfulOpen = Exclude<OpenCrateResult, { type: "error" }>;

export default function CrateOpeningModal({
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
  onQuantityChange: (crateId: string, delta: number, keyDelta?: number) => void;
  onSuccess: (result: SuccessfulOpen) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(true);
  const [result, setResult] = useState<SuccessfulOpen | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playbackDone, setPlaybackDone] = useState(false);
  const [revealSkipped, setRevealSkipped] = useState(false);
  const actionStarted = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const revealVisible = result !== null && (playbackDone || revealSkipped);
  const hasOpeningVideos =
    !!crate.openingVideoGoldUrl || !!crate.openingVideoNormalUrl;
  const videoUrl =
    result?.videoVariant === "gold"
      ? crate.openingVideoGoldUrl
      : result?.videoVariant === "normal"
        ? crate.openingVideoNormalUrl
        : null;

  useEffect(() => {
    if (!videoReady || !videoRef.current) return;
    void videoRef.current.play().catch((error: unknown) => {
      console.error("Black Market crate video playback failed:", error);
      setVideoFailed(true);
    });
  }, [videoReady]);

  useEffect(() => {
    if (!hasOpeningVideos) return;
    if (actionStarted.current) return;
    actionStarted.current = true;
    if (crate.quantity < 1) {
      onError(errorMessage("NO_CRATES"));
      onClose();
      return;
    }
    if (crate.requiresKey && crate.keyQuantity < 1) {
      onError(errorMessage("NO_KEYS"));
      onClose();
      return;
    }

    onError("");
    onQuantityChange(crate.id, -1, crate.requiresKey ? -1 : 0);
    void openCrate(accountId, crate.id)
      .then((response) => {
        setPending(false);
        if (response.type === "error") {
          onQuantityChange(crate.id, 1, crate.requiresKey ? 1 : 0);
          onError(errorMessage(response.code));
          onClose();
          return;
        }
        setResult(response);
        onSuccess(response);
      })
      .catch((error: unknown) => {
        console.error("Black Market crate opening failed:", error);
        onQuantityChange(crate.id, 1, crate.requiresKey ? 1 : 0);
        setPending(false);
        onError(errorMessage("INTERNAL_ERROR"));
        onClose();
      });
  }, [
    accountId,
    crate.id,
    crate.keyQuantity,
    hasOpeningVideos,
    crate.quantity,
    crate.requiresKey,
    onClose,
    onError,
    onQuantityChange,
    onSuccess,
  ]);

  function close() {
    if (!result) return;
    router.refresh();
    onClose();
  }

  function skipAnimation() {
    videoRef.current?.pause();
    setRevealSkipped(true);
  }

  if (!hasOpeningVideos) {
    return (
      <SimpleOpenCrateModal
        accountId={accountId}
        crate={crate}
        onClose={onClose}
        onQuantityChange={onQuantityChange}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }

  if (videoFailed || (result !== null && !videoUrl)) {
    return (
      <SimpleOpenCrateModal
        accountId={accountId}
        crate={crate}
        onClose={close}
        onQuantityChange={onQuantityChange}
        onSuccess={onSuccess}
        onError={onError}
        externalResult={result}
        externalPending={pending}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-zinc-950 text-white">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Opening ${crate.name}`}
        className="app-fullscreen-dialog relative h-full w-full overflow-hidden bg-zinc-950"
      >
        <div className="absolute inset-0">
          {videoUrl && (
            <video
              key={videoUrl}
              ref={videoRef}
              muted
              playsInline
              preload="auto"
              onCanPlay={() => setVideoReady(true)}
              onEnded={() => setPlaybackDone(true)}
              onError={() => setVideoFailed(true)}
              className={`h-full w-full object-contain transition-opacity duration-300 ${videoReady ? "opacity-100" : "opacity-0"}`}
              aria-label={`${crate.name} ${result?.videoVariant} opening animation`}
            >
              <source src={videoUrl} type="video/webm" />
            </video>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-5 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
              Black Market
            </p>
            <h1 className="mt-2 text-xl font-black sm:text-2xl">{crate.name}</h1>
          </div>
        </div>
        {!videoFailed && !videoReady && (
          <div
            role="status"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-200"
          >
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
            <p className="text-sm">
              {!result
                ? pending
                  ? "Drawing crate reward…"
                  : "Preparing reveal…"
                : `Loading ${result.videoVariant}.webm…`}
            </p>
          </div>
        )}
        {result && !revealVisible && !videoFailed && (
          <button
            type="button"
            onClick={skipAnimation}
            className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/30 bg-black/70 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
          >
            Skip animation
          </button>
        )}
        {revealVisible && <ItemReveal result={result} onClose={close} />}
      </section>
    </div>
  );
}
