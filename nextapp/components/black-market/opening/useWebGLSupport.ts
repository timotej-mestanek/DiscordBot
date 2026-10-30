"use client";

import { useEffect, useState } from "react";

export default function useWebGLSupport() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webglSupported = false;
    if (!reducedMotion) {
      try {
        const canvas = document.createElement("canvas");
        const webgl =
          canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
          canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
        webglSupported = webgl !== null;
        webgl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        webglSupported = false;
      }
    }
    const frame = requestAnimationFrame(() => setSupported(webglSupported));
    return () => cancelAnimationFrame(frame);
  }, []);

  return supported;
}
