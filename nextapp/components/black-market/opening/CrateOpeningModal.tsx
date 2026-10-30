"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openCrate } from "@/lib/black-market/actions";
import type { OpenCrateResult } from "@/lib/black-market/actions";
import { errorMessage } from "../error-messages";
import type { BlackMarketCrate } from "../types";
import SimpleOpenCrateModal from "../SimpleOpenCrateModal";
import ItemReveal from "./ItemReveal";
import type { OpeningPhase } from "./CrateCanvas";
import useWebGLSupport from "./useWebGLSupport";

const CrateCanvas = dynamic(() => import("./CrateCanvas"), { ssr: false });

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
  onQuantityChange: (crateId: string, delta: number) => void;
  onSuccess: (result: SuccessfulOpen) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const webglSupported = useWebGLSupport();
  const [pending, setPending] = useState(true);
  const [result, setResult] = useState<SuccessfulOpen | null>(null);
  const [phase, setPhase] = useState<OpeningPhase>("spinning");
  const [animationDone, setAnimationDone] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const actionStarted = useRef(false);
  const animationSkipped = useRef(false);
  const animationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleModelLoaded = useCallback(() => setModelLoaded(true), []);
  const handleModelError = useCallback(() => setModelFailed(true), []);

  useEffect(() => {
    if (actionStarted.current) return;
    actionStarted.current = true;
    if (crate.quantity < 1) {
      onError(errorMessage("NO_CRATES"));
      onClose();
      return;
    }

    onError("");
    onQuantityChange(crate.id, -1);
    void openCrate(accountId, crate.id)
      .then((response) => {
        setPending(false);
        if (response.type === "error") {
          onQuantityChange(crate.id, 1);
          onError(errorMessage(response.code));
          onClose();
          return;
        }
        setResult(response);
        onSuccess(response);
      })
      .catch((error: unknown) => {
        console.error("Black Market crate opening failed:", error);
        onQuantityChange(crate.id, 1);
        setPending(false);
        onError(errorMessage("INTERNAL_ERROR"));
        onClose();
      });
  }, [accountId, crate.id, crate.quantity, onClose, onError, onQuantityChange, onSuccess]);

  useEffect(() => {
    if (
      webglSupported !== true ||
      !crate.textureUrl ||
      modelFailed ||
      !modelLoaded ||
      animationSkipped.current
    ) {
      return;
    }

    setPhase("spinning");
    const opening = setTimeout(() => setPhase("opening"), 1_500);
    const bursting = setTimeout(() => setPhase("bursting"), 2_250);
    const done = setTimeout(() => {
      setPhase("done");
      setAnimationDone(true);
    }, 3_000);
    animationTimers.current = [opening, bursting, done];
    return () => animationTimers.current.forEach(clearTimeout);
  }, [crate.textureUrl, modelFailed, modelLoaded, webglSupported]);

  function skipAnimation() {
    animationSkipped.current = true;
    animationTimers.current.forEach(clearTimeout);
    setPhase("done");
    setAnimationDone(true);
  }

  function close() {
    if (!result) return;
    router.refresh();
    onClose();
  }

  const useThree =
    webglSupported === true && !!crate.textureUrl && !modelFailed;
  const revealReady = useThree && animationDone && result !== null;

  if (!useThree) {
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
        className="relative h-full w-full overflow-hidden bg-zinc-950"
      >
        <div className="absolute inset-0">
          <CrateCanvas
            url={crate.textureUrl!}
            phase={phase}
            onModelLoaded={handleModelLoaded}
            onModelError={handleModelError}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-5 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
              Black Market
            </p>
            <h1 className="mt-2 text-xl font-black sm:text-2xl">{crate.name}</h1>
          </div>
          {!animationDone && (
            <button
              type="button"
              onClick={skipAnimation}
              className="pointer-events-auto rounded-lg border border-white/30 bg-black/50 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
            >
              Skip animation
            </button>
          )}
        </div>
        {!modelLoaded && !modelFailed && (
          <p role="status" className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-zinc-200">
            Loading crate model…
          </p>
        )}
        {modelLoaded && !result && (
          <p role="status" className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-zinc-200">
            {pending ? "Opening crate…" : "Preparing reveal…"}
          </p>
        )}
        {revealReady && result && <ItemReveal result={result} onClose={close} />}
      </section>
    </div>
  );
}
