import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type GpuSummary } from "../lib/api";
import { Pill } from "./Pill";
import { fmtUsd, fmtGiB } from "../lib/format";

const POSITIVE = "#7a9a4d";
const NEGATIVE = "#b53333";

export function GpuRow({ gpu }: { gpu: GpuSummary }) {
  // Pull recent points so we can compute a Robinhood-style % change.
  // 48 points at the */2 cron = ~96 minutes of recent history.
  const sparkQ = useQuery({
    queryKey: ["sparkline", gpu.gpu_name],
    queryFn: () => api.sparkline(gpu.gpu_name, 48),
    staleTime: 60_000,
  });

  const change = useMemo(() => {
    const pts = sparkQ.data?.points ?? [];
    if (pts.length < 2) return null;
    const first = pts[0].price;
    const last = pts[pts.length - 1].price;
    const delta = last - first;
    const pct = first > 0 ? (delta / first) * 100 : 0;
    return { first, last, delta, pct, points: pts.length };
  }, [sparkQ.data]);

  const isUp = change ? change.delta >= 0 : true;
  const accent = isUp ? POSITIVE : NEGATIVE;

  return (
    <Link
      to={`/gpu/${encodeURIComponent(gpu.gpu_name)}`}
      className="grid grid-cols-12 items-center gap-4 px-5 py-4 border-t border-bordercream hover:bg-parchment hover:px-6 transition-all duration-200 animate-fade-up"
    >
      <div className="col-span-3">
        <div className="font-serif text-feature text-nearblack">{gpu.gpu_name}</div>
        <div className="text-caption text-stone">
          {fmtGiB(gpu.min_gpu_memory_gib)}{gpu.max_gpu_memory_gib !== gpu.min_gpu_memory_gib ? `–${fmtGiB(gpu.max_gpu_memory_gib)}` : ""}
          {" · "}{gpu.providers} provider{gpu.providers === 1 ? "" : "s"}
        </div>
      </div>
      <div className="col-span-2 font-num text-bodysm">
        <span className="text-stone">min </span>
        <span className="text-terracotta">{fmtUsd(gpu.min_price)}/hr</span>
      </div>
      <div className="col-span-2 font-num text-bodysm text-olive">
        <span className="text-stone">avg </span>{fmtUsd(gpu.avg_price)}/hr
      </div>
      <div className="col-span-2 font-num text-bodysm text-olive">
        <span className="text-stone">max </span>{fmtUsd(gpu.max_price)}/hr
      </div>
      <div className="col-span-2 font-num text-bodysm">
        {change == null ? (
          <span className="text-stone">—</span>
        ) : change.delta === 0 ? (
          <span className="text-stone">0.00%</span>
        ) : (
          <span style={{ color: accent }} className="font-medium">
            {isUp ? "▲" : "▼"} {Math.abs(change.pct).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="col-span-1 flex justify-end">
        {gpu.available > 0 ? (
          <Pill tone="neutral">{gpu.available} live</Pill>
        ) : (
          <Pill tone="muted">none live</Pill>
        )}
      </div>
    </Link>
  );
}
