"use client"

import { useEffect, useState } from "react"
import type { GSIData } from "@/types/gsi"
import { useRef } from "react"

export default function Home() {
  const [data, setData] = useState<GSIData | null>(null)
  const [hs,setHs] = useState<number>(0); 
  const fetchedRef = useRef(false);

useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch("/api/csdata");
    const json: { data: GSIData } = await res.json();

    if (json.data.player?.steamid !== "76561198388686432") return;
    setData(json.data);
    const hs = json.data.player?.state?.round_killhs ?? 0;
    const phase = json.data.round?.phase;

    if (phase !== "over") {
      fetchedRef.current = false; // reset pre ďalšie kolo
    }

    if (phase === "over" && !fetchedRef.current) {
      console.log("READ ONCE:", hs);
      setHs(prev => prev + hs);
      fetchedRef.current = true;
    }
  }, 500);

  return () => clearInterval(interval);
}, []);

  if (!data) return <div>Waiting for data...</div>

  return (
    <div style={{ padding: 20 }}>
      <h1>CS2 Live HUD</h1>

      <div>{data.player?.match_stats?.kills}</div>
      <div>{data.player?.match_stats?.deaths}</div>
      <div>{hs}</div>
      <div>headshot rate: {data.player?.match_stats?.kills ? (((hs + (data.player?.state?.round_killhs || 0)) / data.player.match_stats.kills) * 100).toFixed(2) : "0.00"}%</div>
      <pre style={{ fontSize: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}