"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ConfirmContext } from "./confirm-dialog-context";
import type { ConfirmOptions, PendingConfirmation } from "./confirm-dialog-context";

export default function ConfirmDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);
  const queueRef = useRef<PendingConfirmation[]>([]);

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    current.resolve(confirmed);
    const next = queueRef.current.shift() ?? null;
    pendingRef.current = next;
    setPending(next);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const request = { ...options, resolve };
      if (pendingRef.current) {
        queueRef.current.push(request);
      } else {
        pendingRef.current = request;
        setPending(request);
      }
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") settle(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div className="app-dialog-backdrop">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-confirm-title"
            aria-describedby="app-confirm-message"
            className="app-confirm-dialog"
          >
            <div className="app-confirm-copy">
              <p className="app-confirm-eyebrow">
                {pending.danger ? "Action required" : "Please confirm"}
              </p>
              <h2 id="app-confirm-title" className="app-confirm-title">
                {pending.title}
              </h2>
              <p id="app-confirm-message" className="app-confirm-message">
                {pending.message}
              </p>
            </div>
            <div className="app-confirm-actions">
              <button
                type="button"
                className="app-confirm-button app-confirm-cancel"
                onClick={() => settle(false)}
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                className={`app-confirm-button ${
                  pending.danger
                    ? "app-confirm-danger"
                    : "app-confirm-primary"
                }`}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
