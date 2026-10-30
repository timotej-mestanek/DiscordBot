import { notFound } from "next/navigation";
import OverlayView from "../OverlayView";

type Widget = "now-playing" | "spotify" | "top-clip" | "cs2" | "pubg";
type Layout = "bar" | "card";

export default async function OverlayViewPage({
  searchParams,
}: {
  searchParams: Promise<{
    widget?: string;
    layout?: string;
    refresh?: string;
    player?: string;
  }>;
}) {
  const params = await searchParams;
  if (
    params.widget !== "now-playing" &&
    params.widget !== "spotify" &&
    params.widget !== "top-clip" &&
    params.widget !== "cs2" &&
    params.widget !== "pubg"
  ) {
    notFound();
  }
  if (params.layout && params.layout !== "bar" && params.layout !== "card") {
    notFound();
  }

  const widget: Widget = params.widget;
  const layout: Layout = params.layout === "bar" ? "bar" : "card";
  const refresh = Number(params.refresh);
  const allowedRefreshRates =
    widget === "cs2" ? [1, 2, 5] : widget === "spotify" ? [5, 10, 30] : [60, 300];
  const refreshSeconds = allowedRefreshRates.includes(refresh)
    ? refresh
    : widget === "cs2"
      ? 2
      : widget === "spotify"
        ? 5
        : 60;

  return (
    <OverlayView
      widget={widget}
      player={params.player?.slice(0, 32) ?? ""}
      layout={layout}
      refreshSeconds={refreshSeconds}
    />
  );
}
