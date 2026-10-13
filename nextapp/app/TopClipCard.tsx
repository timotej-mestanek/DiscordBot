"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { TwitchClip } from "@/lib/services/twitchPublic";

export default function TopClipCard({
  initialClip,
}: {
  initialClip: TwitchClip | null;
}) {
  const [clip, setClip] = useState(initialClip);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/overlays/top-clip", { cache: "no-store" });
        if (!response.ok) throw new Error(`Overlay request failed: ${response.status}`);
        const result: { clip: TwitchClip | null } = await response.json();
        if (active) setClip(result.clip);
      } catch (error) {
        console.error("Could not refresh top-clip overlay:", error);
      }
    };
    const timer = window.setInterval(() => void refresh(), 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
      <p className="px-5 pt-5 text-sm font-semibold uppercase tracking-widest text-amber-300">Top klip</p>
      {clip ? (
        <>
          <a href={clip.url} target="_blank" rel="noreferrer" className="mt-4 block">
            <Image
              src={clip.thumbnail_url}
              alt=""
              width={640}
              height={360}
              unoptimized
              className="aspect-video w-full object-cover"
            />
          </a>
          <div className="p-5 pt-3">
            <a href={clip.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-amber-200">
              {clip.title}
            </a>
            <p className="mt-1 text-sm text-zinc-400">
              {clip.view_count.toLocaleString("cs-CZ")} zhlédnutí · {clip.creator_name}
            </p>
          </div>
        </>
      ) : (
        <p className="p-5 pt-3 text-sm text-zinc-400">Top klip zatím není dostupný.</p>
      )}
    </article>
  );
}
